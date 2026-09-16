const path = require('path')
const config = require('../config/config')

const isTrue = (value) => ['true', '1', 'yes'].includes(String(value || '').toLowerCase())
const useSqlite = isTrue(process.env.USE_SQLITE)
const usePostgres = !useSqlite && process.env.NODE_ENV !== 'test' &&
  Boolean(
    process.env.DATABASE_URL ||
    process.env.DB_URL ||
    process.env.POSTGRES_URL ||
    isTrue(process.env.USE_POSTGRES)
  )

function createSqliteDb() {
  const Database = require('better-sqlite3')
  const dbPath = path.resolve(__dirname, '../../', config.db.path)
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  return db
}

function createPostgresDb() {
  const { Pool } = require('pg')
  const deasync = require('deasync')

  const connectionString = config.db.url
  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes('neon.tech') || connectionString.includes('sslmode=require')
      ? { rejectUnauthorized: false }
      : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  })

  pool.on('error', (err) => {
    console.error('[DB] Unexpected PostgreSQL pool error:', err)
  })

  let probeSucceeded = false
  let probeError = null

  pool.query('SELECT 1')
    .then(() => {
      probeSucceeded = true
    })
    .catch((error) => {
      probeError = error
    })

  deasync.loopWhile(() => !probeSucceeded && !probeError)

  if (probeError) {
    pool.end().catch(() => {})
    throw new Error(`[DB] PostgreSQL connection failed: ${probeError.message}`)
  }

  console.log('[DB] Using PostgreSQL database.')

  let transactionClient = null

  function waitFor(promise) {
    const done = { value: false }
    let result
    let error
    promise
      .then((value) => { result = value; done.value = true })
      .catch((err) => { error = err; done.value = true })
    deasync.loopWhile(() => !done.value)
    if (error) throw error
    return result
  }

  function normalizeSql(sql) {
    return String(sql)
      .replace(/datetime\(\s*['\"]now['\"]\s*\)/gi, 'NOW()')
      .replace(/CURRENT_TIMESTAMP/gi, 'NOW()')
      .replace(/\?/g, (match, offset, full) => {
        const before = full.slice(0, offset)
        const questionCount = (before.match(/\?/g) || []).length + 1
        return `$${questionCount}`
      })
  }

  function runQuery(sql, params = []) {
    const text = normalizeSql(sql)
    const done = { value: false }
    let result
    let err

    const queryTarget = transactionClient || pool
    queryTarget.query(text, params)
      .then((res) => {
        result = res
        done.value = true
      })
      .catch((e) => {
        err = e
        done.value = true
      })

    deasync.loopWhile(() => !done.value)

    if (err) throw err
    return result
  }

  function createStatement(sql) {
    return {
      get: (...args) => {
        const result = runQuery(sql, args)
        return result.rows?.[0] ?? undefined
      },
      all: (...args) => {
        const result = runQuery(sql, args)
        return result.rows ?? []
      },
      run: (...args) => {
        const result = runQuery(sql, args)
        return {
          changes: result.rowCount ?? 0,
          lastInsertRowid: result.rows?.[0]?.id ?? null,
        }
      },
    }
  }

  return {
    prepare: (sql) => createStatement(sql),
    exec: (sql) => {
      const statements = String(sql)
        .split(';')
        .map((statement) => statement.trim())
        .filter(Boolean)

      for (const statement of statements) {
        runQuery(statement)
      }

      return { changes: 0 }
    },
    transaction: (callback) => (...args) => {
      if (transactionClient) return callback(...args)

      const client = waitFor(pool.connect())
      transactionClient = client
      try {
        waitFor(client.query('BEGIN'))
        const result = callback(...args)
        waitFor(client.query('COMMIT'))
        return result
      } catch (error) {
        try { waitFor(client.query('ROLLBACK')) } catch (_) {}
        throw error
      } finally {
        transactionClient = null
        client.release()
      }
    },
    close: () => pool.end(),
    query: (sql, params = []) => runQuery(sql, params),
    raw: (sql, params = []) => runQuery(sql, params),
  }
}

const activeDb = usePostgres ? createPostgresDb() : createSqliteDb()

module.exports = {
  dialect: usePostgres ? 'postgres' : 'sqlite',
  prepare: (sql) => activeDb.prepare(sql),
  exec: (sql) => activeDb.exec(sql),
  transaction: (callback) => (...args) => callback(...args),
  close: () => {
    if (activeDb && typeof activeDb.close === 'function') return activeDb.close()
    return undefined
  },
  query: (sql, params = []) => activeDb.query ? activeDb.query(sql, params) : activeDb.prepare(sql).all(...params),
  raw: (sql, params = []) => activeDb.raw ? activeDb.raw(sql, params) : activeDb.prepare(sql).all(...params),
}
