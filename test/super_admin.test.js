const { after, test } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const express = require('express')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-access-secret-that-is-at-least-32-characters-long'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-characters-long'
process.env.ADMIN_PHONE = '0900000000'
process.env.ADMIN_PASSWORD = 'test-admin-password'
process.env.SUPER_ADMIN_PHONE = '0900000001'
process.env.SUPER_ADMIN_PASSWORD = 'test-super-password'
process.env.SUPER_ADMIN_NAME = 'Test Super Admin'
process.env.DB_PATH = `./data/super-admin-test-${process.pid}-${crypto.randomUUID()}.sqlite`

const db = require('../src/database/db')
const { createTables } = require('../src/database/schema')
const superAuthRoutes = require('../src/routes/super_admin_login_route')
const superManageRoutes = require('../src/routes/super_admin_manage_route')
const errorHandler = require('../src/middleware/errorHandler')

createTables()
const superAdminId = crypto.randomUUID()
const adminId = crypto.randomUUID()
db.prepare('INSERT INTO super_admins (id, phone, password, name) VALUES (?, ?, ?, ?)')
  .run(superAdminId, '0900000001', bcrypt.hashSync('correct-password', 10), 'Test Super Admin')
db.prepare('INSERT INTO admins (id, phone, password, name, status) VALUES (?, ?, ?, ?, ?)')
  .run(adminId, '0900000002', bcrypt.hashSync('admin-password', 10), 'Managed Admin', 'Active')

const testDatabasePath = path.resolve(__dirname, '..', process.env.DB_PATH)
after(() => {
  db.close()
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(`${testDatabasePath}${suffix}`) } catch (_) {}
  }
})

function createApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/super-auth', superAuthRoutes)
  app.use('/api/super/admins', superManageRoutes)
  app.use(errorHandler)
  return app
}

async function request(app, path, options = {}) {
  const server = app.listen(0)
  await new Promise(resolve => server.once('listening', resolve))
  const url = `http://127.0.0.1:${server.address().port}${path}`
  try {
    return await fetch(url, { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } })
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
}

function superToken() {
  return jwt.sign({ id: superAdminId, phone: '0900000001', type: 'super_admin' }, process.env.JWT_SECRET, { expiresIn: '15m' })
}

function authHeaders() {
  return { authorization: `Bearer ${superToken()}` }
}

test('invalid login returns 401 with a useful error', async () => {
  const response = await request(createApp(), '/api/super-auth/login', {
    method: 'POST', body: JSON.stringify({ phone: '0900000001', password: 'wrong-password' }),
  })
  assert.equal(response.status, 401)
  assert.equal((await response.json()).message, 'Invalid phone or password')
})

test('malformed refresh tokens return 401', async () => {
  db.prepare('INSERT INTO super_admin_tokens (id, token, super_admin_id, expires_at) VALUES (?, ?, ?, ?)')
    .run(crypto.randomUUID(), 'malformed-token', superAdminId, new Date(Date.now() + 60000).toISOString())
  const response = await request(createApp(), '/api/super-auth/refresh', {
    method: 'POST', body: JSON.stringify({ refreshToken: 'malformed-token' }),
  })
  assert.equal(response.status, 401)
})

test('bulk requests validate payloads and reject missing ids', async () => {
  const invalid = await request(createApp(), '/api/super/admins/bulk/reset-password', {
    method: 'POST', headers: authHeaders(), body: JSON.stringify({ ids: [adminId], password: 'short' }),
  })
  assert.equal(invalid.status, 400)

  const missing = await request(createApp(), '/api/super/admins/bulk/status', {
    method: 'POST', headers: authHeaders(), body: JSON.stringify({ ids: ['missing-id'], status: 'Inactive' }),
  })
  assert.equal(missing.status, 404)
})

test('deactivation revokes refresh sessions and blocks access tokens', async () => {
  const refreshToken = jwt.sign({ id: adminId, phone: '0900000002' }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' })
  db.prepare('INSERT INTO refresh_tokens (id, token, admin_id, expires_at) VALUES (?, ?, ?, ?)')
    .run(crypto.randomUUID(), refreshToken, adminId, new Date(Date.now() + 60000).toISOString())

  const response = await request(createApp(), `/api/super/admins/${adminId}/status`, {
    method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ status: 'Inactive' }),
  })
  assert.equal(response.status, 200)
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM refresh_tokens WHERE admin_id = ?').get(adminId).count, 0)
})

test('password change reports a missing super-admin as 404', async () => {
  const token = jwt.sign({ id: 'missing', phone: 'missing', type: 'super_admin' }, process.env.JWT_SECRET, { expiresIn: '15m' })
  const response = await request(createApp(), '/api/super-auth/change-password', {
    method: 'PUT', headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify({ currentPassword: 'old-password', newPassword: 'new-password' }),
  })
  assert.equal(response.status, 404)
})
