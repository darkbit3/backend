require('dotenv').config()
const bcrypt         = require('bcryptjs')
const { v4: uuidv4 } = require('uuid')
const { createTables } = require('./schema')
const db             = require('./db')
const config         = require('../config/config')

async function seedAdmin() {
  const phone    = config.admin.phone
  const password = config.admin.password
  const hash     = await bcrypt.hash(password, 10)

  const existing = db.prepare('SELECT id FROM admins WHERE phone = ?').get(phone)

  if (!existing) {
    db.prepare(
      'INSERT INTO admins (id, phone, password, name) VALUES (?, ?, ?, ?)'
    ).run(uuidv4(), phone, hash, 'Admin')
    console.log(`[DB] Admin created — phone: ${phone}`)
  } else {
    // Always overwrite password so stale hashes on Render never block login
    db.prepare(
      `UPDATE admins SET password = ?, updated_at = datetime('now') WHERE phone = ?`
    ).run(hash, phone)
    console.log(`[DB] Admin password synced — phone: ${phone}`)
  }
}

async function seedSuperAdmin() {
  const phone    = process.env.SUPER_ADMIN_PHONE
  const password = process.env.SUPER_ADMIN_PASSWORD
  const name     = process.env.SUPER_ADMIN_NAME

  if (!phone || !password || !name) {
    console.warn('[DB] Super admin seed skipped: SUPER_ADMIN_PHONE, SUPER_ADMIN_PASSWORD, and SUPER_ADMIN_NAME are not configured.')
    return
  }

  const hash     = await bcrypt.hash(password, 10)

  const existing = db.prepare('SELECT id FROM super_admins WHERE phone = ? OR LOWER(name) = LOWER(?)').get(phone, name)

  if (!existing) {
    db.prepare(
      'INSERT INTO super_admins (id, phone, password, name) VALUES (?, ?, ?, ?)'
    ).run(uuidv4(), phone, hash, name)
    console.log(`[DB] Super admin created — username: ${phone}`)
  } else {
    db.prepare(
      `UPDATE super_admins SET phone = ?, name = ?, password = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(phone, name, hash, existing.id)
    console.log(`[DB] Super admin password synced — username: ${phone}`)
  }
}

// Allow running directly: node src/database/init.js
if (require.main === module) {
  createTables()
  Promise.all([seedAdmin(), seedSuperAdmin()])
    .then(() => console.log('[DB] Done.'))
    .catch(console.error)
}

module.exports = { seedAdmin, seedSuperAdmin }
