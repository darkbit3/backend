require('dotenv').config()
const bcrypt         = require('bcryptjs')
const { v4: uuidv4 } = require('uuid')
const { createTables } = require('./schema')
const db             = require('./db')
const config         = require('../config/config')
const { normalizePhone } = require('../utils/phone')

function seedAdmin() {
  const phone    = normalizePhone(config.admin.phone) || config.admin.phone
  const password = config.admin.password
    const hash     = bcrypt.hashSync(password, 10)

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

function seedSuperAdmin() {
  const configuredPhone = process.env.SUPER_ADMIN_PHONE
  const phone    = normalizePhone(configuredPhone) || configuredPhone
  const email    = process.env.SUPER_ADMIN_EMAIL
  const password = process.env.SUPER_ADMIN_PASSWORD
  const name     = process.env.SUPER_ADMIN_NAME

  if (!phone || !email || !password || !name) {
    console.warn('[DB] Super admin seed skipped: SUPER_ADMIN_PHONE, SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, and SUPER_ADMIN_NAME are not configured.')
    return
  }

    const hash     = bcrypt.hashSync(password, 10)

  const existing = db.prepare('SELECT id FROM super_admins WHERE phone = ? OR LOWER(name) = LOWER(?)').get(phone, name)

  if (!existing) {
    db.prepare(
      'INSERT INTO super_admins (id, phone, email, password, name) VALUES (?, ?, ?, ?, ?)'
    ).run(uuidv4(), phone, email || null, hash, name)
    console.log(`[DB] Super admin created — username: ${phone}`)
  } else {
    db.prepare(
      `UPDATE super_admins SET phone = ?, name = ?, password = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(phone, name, hash, existing.id)
    if (email) db.prepare('UPDATE super_admins SET email = ? WHERE id = ?').run(email, existing.id)
    console.log(`[DB] Super admin password synced — username: ${phone}`)
  }
}

/**
 * After super_admins exist, back-fill the created_by on the 5 fixed groups
 * from 'system' to the real super admin id.
 */
function reseedFixedGroups() {
  const superAdminRow = db.prepare('SELECT id FROM super_admins ORDER BY created_at ASC LIMIT 1').get()
  if (!superAdminRow) return
  const FIXED_GROUP_IDS = [
    'group-cherk',
    'group-general',
    'group-business',
    'group-support',
    'group-boutique-garment',
  ]
  const update = db.prepare(`UPDATE chat_groups SET created_by = ? WHERE id = ? AND created_by = 'system'`)
  for (const id of FIXED_GROUP_IDS) {
    update.run(superAdminRow.id, id)
  }
  console.log('[DB] Fixed groups created_by synced.')
}

// Allow running directly: node src/database/init.js
if (require.main === module) {
  createTables()
  try {
    seedAdmin()
    seedSuperAdmin()
    reseedFixedGroups()
    console.log('[DB] Done.')
    db.close()
  } catch (error) {
    console.error(error)
    process.exitCode = 1
  }
}

module.exports = { seedAdmin, seedSuperAdmin, reseedFixedGroups }
