require('dotenv').config()
const Database = require('better-sqlite3')
const { Pool } = require('pg')

const sourcePath = process.env.SQLITE_SOURCE_PATH || './data/database.sqlite'
const sqlite = new Database(sourcePath, { readonly: true })
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const maps = {
  admins: new Map(),
  super_admins: new Map(),
  users: new Map(),
  cashiers: new Map(),
  cutters: new Map(),
}

function sqliteHasTable(table) {
  return Boolean(sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table))
}

async function findId(table, column, value) {
  if (!value) return null
  const result = await pool.query(`SELECT id FROM ${table} WHERE ${column} = $1 LIMIT 1`, [value])
  return result.rows[0]?.id || null
}

async function insertRow(table, row, columns, conflict = 'DO NOTHING') {
  const values = columns.map(column => row[column])
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ')
  const result = await pool.query(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT ${conflict} RETURNING id`,
    values,
  )
  return result.rows[0]?.id || null
}

async function migrateAdmins() {
  for (const row of sqlite.prepare('SELECT * FROM admins ORDER BY created_at').all()) {
    const existingId = await findId('admins', 'phone', row.phone)
    if (existingId) {
      maps.admins.set(row.id, existingId)
      continue
    }
    const id = await insertRow('admins', row, ['id', 'phone', 'email', 'password', 'name', 'status', 'created_at', 'updated_at'])
    maps.admins.set(row.id, id || row.id)
  }
}

async function migrateSuperAdmins() {
  for (const row of sqlite.prepare('SELECT * FROM super_admins ORDER BY created_at').all()) {
    const existingId = await findId('super_admins', 'phone', row.phone) || await findId('super_admins', 'email', row.email)
    if (existingId) {
      maps.super_admins.set(row.id, existingId)
      continue
    }
    const id = await insertRow('super_admins', row, ['id', 'phone', 'email', 'password', 'name', 'status', 'created_at', 'updated_at'])
    maps.super_admins.set(row.id, id || row.id)
  }
}

async function migrateUsers() {
  for (const row of sqlite.prepare('SELECT * FROM users ORDER BY created_at').all()) {
    const mappedAdminId = maps.admins.get(row.admin_id) || row.admin_id || null
    const existingId = await findId('users', 'phone', row.phone)
    if (existingId) {
      maps.users.set(row.id, existingId)
      continue
    }
    const id = await insertRow('users', { ...row, admin_id: mappedAdminId }, [
      'id', 'name', 'phone', 'password', 'plain_password', 'role', 'account_type', 'free_until',
      'status', 'created_at', 'updated_at', 'admin_id', 'alert_threshold_percentage',
    ])
    maps.users.set(row.id, id || row.id)
  }
}

async function migrateOwnedRows(table, columns, ownerColumn, phoneColumn = 'phone') {
  for (const row of sqlite.prepare(`SELECT * FROM ${table} ORDER BY created_at`).all()) {
    const mappedOwnerId = maps.users.get(row[ownerColumn]) || row[ownerColumn]
    const existingId = await findId(table, phoneColumn, row[phoneColumn])
    if (existingId) {
      maps[table].set(row.id, existingId)
      continue
    }
    const id = await insertRow(table, { ...row, [ownerColumn]: mappedOwnerId }, columns)
    maps[table].set(row.id, id || row.id)
  }
}

async function migrateMaterials() {
  for (const row of sqlite.prepare('SELECT * FROM materials ORDER BY created_at').all()) {
    const mappedUserId = maps.users.get(row.user_id) || row.user_id
    const id = await insertRow('materials', { ...row, user_id: mappedUserId }, [
      'id', 'user_id', 'name', 'quantity', 'initial_quantity', 'unit', 'unit_price',
      'initial_price', 'image_url', 'colors', 'created_at',
    ])
    if (!id) continue
  }
}

async function migrateSalesAndCredits() {
  for (const row of sqlite.prepare('SELECT * FROM sales ORDER BY created_at').all()) {
    await insertRow('sales', {
      ...row,
      cashier_id: maps.cashiers.get(row.cashier_id) || row.cashier_id,
      owner_id: maps.users.get(row.owner_id) || row.owner_id,
    }, ['id', 'cashier_id', 'owner_id', 'customer', 'payment_type', 'total_amount', 'note', 'created_at'])
  }

  for (const row of sqlite.prepare('SELECT * FROM sale_items').all()) {
    await insertRow('sale_items', row, ['id', 'sale_id', 'material', 'material_id', 'quantity', 'unit_price', 'total'])
  }

  for (const row of sqlite.prepare('SELECT * FROM credits ORDER BY created_at').all()) {
    await insertRow('credits', {
      ...row,
      cashier_id: row.cashier_id ? (maps.cashiers.get(row.cashier_id) || row.cashier_id) : null,
      owner_id: maps.users.get(row.owner_id) || row.owner_id,
    }, ['id', 'sale_id', 'cashier_id', 'owner_id', 'customer', 'total_amount', 'total_paid', 'note', 'issued_by', 'issued_by_id', 'created_at'])
  }

  for (const row of sqlite.prepare('SELECT * FROM credit_payments').all()) {
    await insertRow('credit_payments', row, ['id', 'credit_id', 'amount', 'note', 'paid_at'])
  }
}

async function migrateChats() {
  for (const row of sqlite.prepare('SELECT * FROM chat_messages').all()) {
    await insertRow('chat_messages', {
      ...row,
      sender_id: row.sender_role === 'admin' ? (maps.admins.get(row.sender_id) || row.sender_id) : (maps.users.get(row.sender_id) || row.sender_id),
      receiver_id: row.receiver_role === 'admin' ? (maps.admins.get(row.receiver_id) || row.receiver_id) : (maps.users.get(row.receiver_id) || row.receiver_id),
    }, ['id', 'sender_id', 'sender_role', 'receiver_id', 'receiver_role', 'message', 'status', 'created_at'])
  }

  for (const row of sqlite.prepare('SELECT * FROM chat_groups').all()) {
    await insertRow('chat_groups', { ...row, created_by: maps.super_admins.get(row.created_by) || row.created_by }, ['id', 'name', 'description', 'created_by', 'created_at'])
  }

  for (const row of sqlite.prepare('SELECT * FROM chat_group_members').all()) {
    await insertRow('chat_group_members', { ...row, user_id: row.user_role === 'admin' ? (maps.admins.get(row.user_id) || row.user_id) : (maps.users.get(row.user_id) || row.user_id) }, ['id', 'group_id', 'user_id', 'user_role', 'joined_at'])
  }

  for (const row of sqlite.prepare('SELECT * FROM chat_group_messages').all()) {
    await insertRow('chat_group_messages', { ...row, sender_id: row.sender_role === 'admin' ? (maps.admins.get(row.sender_id) || row.sender_id) : (maps.users.get(row.sender_id) || row.sender_id) }, ['id', 'group_id', 'sender_id', 'sender_role', 'message', 'status', 'created_at'])
  }
}

async function migrateSettings() {
  if (!sqliteHasTable('system_settings')) return
  for (const row of sqlite.prepare('SELECT * FROM system_settings').all()) {
    await insertRow('system_settings', row, ['id', 'setting_key', 'setting_value', 'description', 'created_at', 'updated_at'], 'DO UPDATE SET setting_value = EXCLUDED.setting_value, description = EXCLUDED.description, updated_at = EXCLUDED.updated_at')
  }
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
  await pool.query('ALTER TABLE materials DROP CONSTRAINT IF EXISTS materials_unit_check')
  await pool.query("ALTER TABLE materials ADD CONSTRAINT materials_unit_check CHECK (unit IN ('Meter', 'Piece', 'Kilogram'))")
  await migrateAdmins()
  await migrateSuperAdmins()
  await migrateUsers()
  await migrateOwnedRows('cashiers', ['id', 'owner_id', 'name', 'phone', 'password', 'plain_password', 'status', 'created_at', 'updated_at'], 'owner_id')
  await migrateOwnedRows('cutters', ['id', 'owner_id', 'name', 'phone', 'password', 'plain_password', 'status', 'created_at', 'updated_at'], 'owner_id')
  await migrateMaterials()
  await migrateSalesAndCredits()
  await migrateChats()
  await migrateSettings()
  console.log(`[DB] SQLite data migrated to PostgreSQL from ${sourcePath}`)
}

main().catch(error => {
  console.error('[DB] Migration failed:', error.message)
  process.exitCode = 1
}).finally(() => {
  sqlite.close()
  pool.end()
})
