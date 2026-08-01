require('dotenv').config()
const bcrypt         = require('bcryptjs')
const { v4: uuidv4 } = require('uuid')
const { createTables } = require('./schema')
const db             = require('./db')
const config         = require('../config/config')

async function seed() {
  createTables()

  // Seed default admin if not exists
  const existing = db.prepare('SELECT id FROM admins WHERE phone = ?').get(config.admin.phone)
  if (!existing) {
    const hash = await bcrypt.hash(config.admin.password, 10)
    db.prepare(`
      INSERT INTO admins (id, phone, password, name)
      VALUES (?, ?, ?, ?)
    `).run(uuidv4(), config.admin.phone, hash, 'Super Admin')
    console.log(`[DB] Admin seeded — phone: ${config.admin.phone}`)
  } else {
    console.log('[DB] Admin already exists, skipping seed.')
  }

  console.log('[DB] Database initialized successfully.')
}

seed().catch(console.error)
