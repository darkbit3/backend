require('dotenv').config()
const bcrypt         = require('bcryptjs')
const { v4: uuidv4 } = require('uuid')
const { createTables } = require('./schema')
const db             = require('./db')
const config         = require('../config/config')

async function seedAdmin() {
  const phone    = config.admin.phone    || '0912345678'
  const password = config.admin.password || 'admin123'
  const hash     = await bcrypt.hash(password, 10)

  const existing = db.prepare('SELECT id FROM admins WHERE phone = ?').get(phone)

  if (!existing) {
    db.prepare(
      'INSERT INTO admins (id, phone, password, name) VALUES (?, ?, ?, ?)'
    ).run(uuidv4(), phone, hash, 'Super Admin')
    console.log(`[DB] Admin created — phone: ${phone}`)
  } else {
    // Always overwrite password so stale hashes on Render never block login
    db.prepare(
      `UPDATE admins SET password = ?, updated_at = datetime('now') WHERE phone = ?`
    ).run(hash, phone)
    console.log(`[DB] Admin password synced — phone: ${phone}`)
  }
}

// Allow running directly: node src/database/init.js
if (require.main === module) {
  createTables()
  seedAdmin()
    .then(() => console.log('[DB] Done.'))
    .catch(console.error)
}

module.exports = { seedAdmin }
