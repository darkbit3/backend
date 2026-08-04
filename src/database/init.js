require('dotenv').config()
const bcrypt         = require('bcryptjs')
const { v4: uuidv4 } = require('uuid')
const { createTables } = require('./schema')
const db             = require('./db')
const config         = require('../config/config')

async function seed() {
  createTables()

  // Always ensure the default admin exists with correct credentials
  const existing = db.prepare('SELECT id FROM admins WHERE phone = ?').get(config.admin.phone)
  const hash = await bcrypt.hash(config.admin.password, 10)

  if (!existing) {
    db.prepare(`
      INSERT INTO admins (id, phone, password, name)
      VALUES (?, ?, ?, ?)
    `).run(uuidv4(), config.admin.phone, hash, 'Super Admin')
    console.log(`[DB] Admin created — phone: ${config.admin.phone}`)
  } else {
    // Always update password to match current .env — fixes stale hash on Render restarts
    db.prepare(`UPDATE admins SET password = ?, updated_at = datetime('now') WHERE phone = ?`)
      .run(hash, config.admin.phone)
    console.log(`[DB] Admin password synced — phone: ${config.admin.phone}`)
  }

  console.log('[DB] Database initialized successfully.')
}

seed().catch(console.error)
