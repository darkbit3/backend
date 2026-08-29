const { Pool } = require('pg')
const deasync = require('deasync')
const config = require('../config/config')

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

function normalizeSql(sql) {
  return String(sql)
    .replace(/datetime\(\s*['\"]now['\"]\s*\)/gi, 'NOW()')
    .replace(/datetime\(\s*['\"]now['\"]\s*\)/gi, 'NOW()')
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

  pool.query(text, params)
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

const db = {
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
  transaction: (callback) => (...args) => callback(...args),
  close: () => pool.end(),
  query: (sql, params = []) => runQuery(sql, params),
  raw: (sql, params = []) => runQuery(sql, params),
}

module.exports = db
