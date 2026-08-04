require('dotenv').config()
const bcrypt         = require('bcryptjs')
const { v4: uuidv4 } = require('uuid')
const { createTables } = require('./schema')
const db             = require('./db')
const config         = require('../config/config')

async function seedAdmin() {
  const existing = db.prepare('SELECT id FROM admins WHERE phone = ?').get(config.admin.phone)
  const hash = await bcrypt.hash(config.admin.password, 10)

  if (!existing) {
    db.prepare(`
      INSERT INTO admins (id, phone, password, name)
      VALUES (?, ?, ?, ?)
    `).run(uuidv4(), config.admin.phone, hash, 'Super Admin')
    console.log(`[DB] Admin created — phone: ${config.admin.phone}`)
  } else {
    // Always sync password to match current env — fixes stale hash on Render restarts
    db.prepare(`UPDATE admins SET password = ?, updated_at = datetime('now') WHERE phone = ?`)
      .run(hash, config.admin.phone)
    console.log(`[DB] Admin password synced — phone: ${config.admin.phone}`)
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
