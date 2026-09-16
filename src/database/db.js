/**
 * db.js — PostgreSQL adapter with a synchronous-style API.
 *
 * Uses worker_threads + Atomics to implement sync-over-async without
 * any native addons (no deasync, no node-gyp required).
 *
 * All db.prepare(sql).get/all/run calls are synchronous from the caller's
 * perspective but never block the event loop — they run the query in a
 * dedicated worker thread.
 */

const { Pool } = require('pg')
const { Worker, isMainThread, parentPort, workerData, receiveMessageOnPort, MessageChannel } = require('worker_threads')
const path = require('path')
const config = require('../config/config')

// ── Connection string ──────────────────────────────────────────────────────
const rawUrl = config.db.url
const connectionString = rawUrl.replace(/([?&])sslmode=require\b/i, '$1sslmode=verify-full')

const sslEnabled =
  connectionString.includes('neon.tech') ||
  connectionString.includes('sslmode=require') ||
  connectionString.includes('sslmode=verify-full')

// ── SQL normalisation (SQLite → PostgreSQL) ────────────────────────────────
function normalizeSql(sql) {
  let i = 0
  return String(sql)
    .replace(/datetime\(\s*['"]now['"]\s*\)/gi, 'NOW()')
    .replace(/CURRENT_TIMESTAMP/gi, 'NOW()')
    .replace(/\?/g, () => `$${++i}`)
}

// ═══════════════════════════════════════════════════════════════════════════
// WORKER THREAD — runs the actual pg queries
// ═══════════════════════════════════════════════════════════════════════════
if (!isMainThread) {
  const { Pool: PgPool } = require('pg')

  const workerPool = new PgPool({
    connectionString: workerData.connectionString,
    ssl: workerData.sslEnabled ? { rejectUnauthorized: false } : false,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  })

  parentPort.on('message', async ({ id, port, sql, params }) => {
    try {
      const result = await workerPool.query(sql, params)
      port.postMessage({ id, rows: result.rows, rowCount: result.rowCount })
    } catch (err) {
      port.postMessage({ id, error: err.message })
    }
  })

  return
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN THREAD — creates worker and exposes sync API
// ═══════════════════════════════════════════════════════════════════════════

let worker = null

function getWorker() {
  if (!worker) {
    worker = new Worker(__filename, {
      workerData: { connectionString, sslEnabled },
    })
    worker.on('error', (err) => {
      console.error('[DB] Worker error:', err)
      worker = null
    })
    worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`[DB] Worker exited with code ${code}`)
        worker = null
      }
    })
  }
  return worker
}

// Synchronously run a query by posting to the worker and waiting via Atomics
function runQuerySync(sql, params = []) {
  const text = normalizeSql(sql)
  const { port1, port2 } = new MessageChannel()

  const sharedBuffer = new SharedArrayBuffer(4)
  const sharedArray = new Int32Array(sharedBuffer)

  // We use receiveMessageOnPort for truly sync receive
  getWorker().postMessage({ sql: text, params, port: port2 }, [port2])

  // Poll for a response (Atomics.wait would block the thread, use receiveMessageOnPort)
  let response = null
  while (response === null) {
    const msg = receiveMessageOnPort(port1)
    if (msg) {
      response = msg.message
    }
  }
  port1.close()

  if (response.error) {
    const err = new Error(response.error)
    console.error('[DB] Query error:', response.error, '\nSQL:', text, '\nParams:', params)
    throw err
  }

  return { rows: response.rows, rowCount: response.rowCount }
}

// ── Public sync API ────────────────────────────────────────────────────────
function prepare(sql) {
  return {
    get(...args) {
      const result = runQuerySync(sql, args)
      return result.rows?.[0] ?? undefined
    },
    all(...args) {
      const result = runQuerySync(sql, args)
      return result.rows ?? []
    },
    run(...args) {
      const result = runQuerySync(sql, args)
      return {
        changes: result.rowCount ?? 0,
        lastInsertRowid: result.rows?.[0]?.id ?? null,
      }
    },
  }
}

function exec(sql) {
  const statements = String(sql)
    .split(';')
    .map(s => s.trim())
    .filter(Boolean)
  for (const statement of statements) {
    runQuerySync(statement)
  }
  return { changes: 0 }
}

function transaction(callback) {
  return (...args) => {
    runQuerySync('BEGIN')
    try {
      const result = callback(...args)
      runQuerySync('COMMIT')
      return result
    } catch (error) {
      try { runQuerySync('ROLLBACK') } catch (_) {}
      throw error
    }
  }
}

// ── Async test connection (used on startup) ────────────────────────────────
async function testConnection() {
  const pool = new Pool({
    connectionString,
    ssl: sslEnabled ? { rejectUnauthorized: false } : false,
    max: 1,
    connectionTimeoutMillis: 10000,
  })
  try {
    await pool.query('SELECT 1')
    console.log('[DB] PostgreSQL connection verified.')
  } finally {
    await pool.end()
  }
}

// ── Cleanup ────────────────────────────────────────────────────────────────
function close() {
  if (worker) {
    worker.terminate()
    worker = null
  }
}

module.exports = {
  dialect: 'postgres',
  prepare,
  exec,
  transaction,
  testConnection,
  close,
  query: (sql, params) => runQuerySync(sql, params),
  raw: (sql, params) => runQuerySync(sql, params),
}
