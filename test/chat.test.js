const { test, after } = require('node:test')
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
process.env.DB_PATH = `./data/chat-test-${process.pid}-${crypto.randomUUID()}.sqlite`

const db = require('../src/database/db')
const { createTables } = require('../src/database/schema')
const chatRoutes = require('../src/routes/chat_route')
const errorHandler = require('../src/middleware/errorHandler')
const adminLoginService = require('../src/services/admin_login_service')

createTables()

const adminId = crypto.randomUUID()
const ownerId = crypto.randomUUID()
const otherOwnerId = crypto.randomUUID()
const senderHash = crypto.randomUUID()
const targetHash = crypto.randomUUID()

const adminToken = jwt.sign({ id: adminId, phone: '0900000002', type: 'admin' }, process.env.JWT_SECRET, { expiresIn: '15m' })

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
  app.use('/api/chat', chatRoutes)
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

test('admin login tokens include the admin role for chat access', async () => {
  const adminPhone = '0900000999'
  const adminId = crypto.randomUUID()
  const password = 'admin-role-check-password'
  const hash = await bcrypt.hash(password, 10)

  db.prepare('DELETE FROM admins WHERE phone = ?').run(adminPhone)
  db.prepare('INSERT INTO admins (id, phone, password, name, status) VALUES (?, ?, ?, ?, ?)')
    .run(adminId, adminPhone, hash, 'Role Check Admin', 'Active')

  const result = await adminLoginService.login(adminPhone, password)
  const decoded = jwt.decode(result.accessToken)

  assert.equal(decoded.type, 'admin')
  assert.equal(decoded.phone, adminPhone)
})

test('chat people list returns database users and supports search', async () => {
  db.prepare('DELETE FROM chat_messages').run()
  db.prepare('DELETE FROM users').run()
  db.prepare('DELETE FROM admins').run()

  db.prepare('INSERT INTO admins (id, phone, password, name, status) VALUES (?, ?, ?, ?, ?)')
    .run(adminId, '0900000002', 'hashed-pass', 'Alpha Admin', 'Active')

  db.prepare('INSERT INTO users (id, name, phone, password, role, admin_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(ownerId, 'Beta Owner', '0900000030', 'secret', 'Manufacturer', adminId, 'Active')
  db.prepare('INSERT INTO users (id, name, phone, password, role, admin_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(otherOwnerId, 'Gamma Client', '0900000031', 'secret', 'Reseller', adminId, 'Active')

  const response = await request(createApp(), '/api/chat/people?search=beta', {
    method: 'GET',
    headers: { authorization: `Bearer ${adminToken}` },
  })

  assert.equal(response.status, 200)
  const json = await response.json()
  assert.equal(json.success, true)
  assert.equal(json.data.length, 1)
  assert.equal(json.data[0].name, 'Beta Owner')
})

test('chat messages return the selected conversation from database', async () => {
  db.prepare('DELETE FROM chat_messages').run()

  db.prepare('INSERT INTO chat_messages (id, sender_id, sender_role, receiver_id, receiver_role, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(crypto.randomUUID(), adminId, 'admin', ownerId, 'user', 'Hello owner', new Date().toISOString())
  db.prepare('INSERT INTO chat_messages (id, sender_id, sender_role, receiver_id, receiver_role, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(crypto.randomUUID(), ownerId, 'user', adminId, 'admin', 'Hi admin', new Date().toISOString())

  const response = await request(createApp(), `/api/chat/messages/${ownerId}`, {
    method: 'GET',
    headers: { authorization: `Bearer ${adminToken}` },
  })

  assert.equal(response.status, 200)
  const json = await response.json()
  assert.equal(json.success, true)
  assert.equal(json.data.length, 2)
  assert.equal(json.data.some((m) => m.message === 'Hello owner'), true)
})

test('super admin-created group appears for invited admin and shows inviter info', async () => {
  db.prepare('DELETE FROM chat_group_members').run()
  db.prepare('DELETE FROM chat_group_messages').run()
  db.prepare('DELETE FROM chat_groups').run()
  db.prepare('DELETE FROM super_admins').run()

  const superAdminId = crypto.randomUUID()
  db.prepare('INSERT INTO super_admins (id, phone, password, name, status) VALUES (?, ?, ?, ?, ?)')
    .run(superAdminId, '0900000100', 'hashed-pass', 'Main Super Admin', 'Active')

  const groupId = crypto.randomUUID()
  db.prepare('INSERT INTO chat_groups (id, name, description, created_by, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(groupId, 'Daily Ops', 'Ops update', superAdminId, new Date().toISOString())

  db.prepare('INSERT INTO chat_group_members (id, group_id, user_id, user_role, joined_at) VALUES (?, ?, ?, ?, ?)')
    .run(crypto.randomUUID(), groupId, adminId, 'admin', new Date().toISOString())

  const response = await request(createApp(), '/api/chat/groups', {
    method: 'GET',
    headers: { authorization: `Bearer ${adminToken}` },
  })

  assert.equal(response.status, 200)
  const json = await response.json()
  assert.equal(json.success, true)
  assert.equal(json.data.length, 1)
  assert.equal(json.data[0].name, 'Daily Ops')
  assert.equal(json.data[0].invitedBy, 'Main Super Admin')
})

test('group creation and group message history are stored in the database', async () => {
  db.prepare('DELETE FROM chat_group_members').run()
  db.prepare('DELETE FROM chat_group_messages').run()
  db.prepare('DELETE FROM chat_groups').run()

  const superAdminId = crypto.randomUUID()
  const adminMemberId = crypto.randomUUID()
  db.prepare('INSERT INTO super_admins (id, phone, password, name, status) VALUES (?, ?, ?, ?, ?)')
    .run(superAdminId, '0900000200', 'hashed-pass', 'Persist Super Admin', 'Active')
  db.prepare('INSERT INTO admins (id, phone, password, name, status) VALUES (?, ?, ?, ?, ?)')
    .run(adminMemberId, '0900000201', 'hashed-pass', 'Persist Admin', 'Active')

  const groupId = crypto.randomUUID()
  db.prepare('INSERT INTO chat_groups (id, name, description, created_by, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(groupId, 'Persist Group', 'Group history test', superAdminId, new Date().toISOString())
  db.prepare('INSERT INTO chat_group_members (id, group_id, user_id, user_role, joined_at) VALUES (?, ?, ?, ?, ?)')
    .run(crypto.randomUUID(), groupId, adminMemberId, 'admin', new Date().toISOString())
  db.prepare('INSERT INTO chat_group_messages (id, group_id, sender_id, sender_role, message, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(crypto.randomUUID(), groupId, superAdminId, 'super_admin', 'Saved history message', new Date().toISOString())

  const savedGroup = db.prepare('SELECT * FROM chat_groups WHERE id = ?').get(groupId)
  const savedMember = db.prepare('SELECT * FROM chat_group_members WHERE group_id = ? AND user_id = ?').get(groupId, adminMemberId)
  const savedMessage = db.prepare('SELECT * FROM chat_group_messages WHERE group_id = ?').get(groupId)

  assert.ok(savedGroup)
  assert.equal(savedGroup.name, 'Persist Group')
  assert.ok(savedMember)
  assert.ok(savedMessage)
  assert.equal(savedMessage.message, 'Saved history message')
})
