const db = require('./db')

function createTables() {
  // Admins table (for admin panel login)
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id          TEXT PRIMARY KEY,
      phone       TEXT NOT NULL UNIQUE,
      email       TEXT,
      password    TEXT NOT NULL,
      name        TEXT NOT NULL DEFAULT 'Admin',
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  // Users table (manufacturer / reseller)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id             TEXT PRIMARY KEY,
      name           TEXT NOT NULL,
      phone          TEXT NOT NULL UNIQUE,
      password       TEXT NOT NULL,
      plain_password TEXT,
      role           TEXT NOT NULL CHECK(role IN ('Manufacturer', 'Reseller')),
      account_type   TEXT NOT NULL DEFAULT 'Free' CHECK(account_type IN ('Free', 'Paid')),
      free_until     TEXT,
      status         TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active', 'Inactive')),
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id            TEXT PRIMARY KEY,
      sender_id     TEXT NOT NULL,
      sender_role   TEXT NOT NULL CHECK(sender_role IN ('admin', 'super_admin', 'user')),
      receiver_id   TEXT NOT NULL,
      receiver_role TEXT NOT NULL CHECK(receiver_role IN ('admin', 'super_admin', 'user')),
      message       TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'sent' CHECK(status IN ('sent', 'read')),
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  // ── Fixed groups (4 predefined groups, all members auto-belong) ─────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_groups (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT,
      created_by  TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_group_members (
      id         TEXT PRIMARY KEY,
      group_id   TEXT NOT NULL,
      user_id    TEXT NOT NULL,
      user_role  TEXT NOT NULL CHECK(user_role IN ('admin', 'user')),
      joined_at  TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (group_id) REFERENCES chat_groups(id) ON DELETE CASCADE
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_group_messages (
      id          TEXT PRIMARY KEY,
      group_id    TEXT NOT NULL,
      sender_id   TEXT NOT NULL,
      sender_role TEXT NOT NULL CHECK(sender_role IN ('super_admin', 'admin', 'user')),
      message     TEXT NOT NULL,
      image_url   TEXT,
      phone_number TEXT,
      status      TEXT NOT NULL DEFAULT 'sent' CHECK(status IN ('sent', 'read')),
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (group_id) REFERENCES chat_groups(id) ON DELETE CASCADE
    );
  `)

  // Migrate: add image_url and phone_number to existing chat_group_messages
  try { db.exec(`ALTER TABLE chat_group_messages ADD COLUMN IF NOT EXISTS image_url TEXT;`) } catch (_) {}
  try { db.exec(`ALTER TABLE chat_group_messages ADD COLUMN IF NOT EXISTS phone_number TEXT;`) } catch (_) {}

  // ── Group categories (created by super admin, with optional image) ───────
  db.exec(`
    CREATE TABLE IF NOT EXISTS group_categories (
      id         TEXT PRIMARY KEY,
      group_id   TEXT NOT NULL,
      name       TEXT NOT NULL,
      image_url  TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (group_id) REFERENCES chat_groups(id) ON DELETE CASCADE
    );
  `)

  // Migrate: add image_url to group_categories if upgrading existing DB
  try { db.exec(`ALTER TABLE group_categories ADD COLUMN IF NOT EXISTS image_url TEXT;`) } catch (_) {}

  // Migrate existing DB — add plain_password and account_type columns if they don't exist yet
  try {
    db.exec(`ALTER TABLE users ADD COLUMN plain_password TEXT;`)
  } catch (_) {}

  try {
    db.exec(`ALTER TABLE users ADD COLUMN account_type TEXT DEFAULT 'Free';`)
  } catch (_) {}

  try {
    db.exec(`ALTER TABLE users ADD COLUMN free_until TEXT;`)
  } catch (_) {}

  // Link each user to the admin who created them
  try {
    db.exec(`ALTER TABLE users ADD COLUMN admin_id TEXT;`)
  } catch (_) {}

  // Alert threshold percentage for low stock (default 20%)
  try {
    db.exec(`ALTER TABLE users ADD COLUMN alert_threshold_percentage REAL DEFAULT 20;`)
  } catch (_) {}

  // Message status tracking: sent (✓) vs read (✓✓)
  try {
    db.exec(`ALTER TABLE chat_messages ADD COLUMN status TEXT DEFAULT 'sent' CHECK(status IN ('sent', 'read'));`)
  } catch (_) {}

  try {
    db.exec(`ALTER TABLE chat_group_messages ADD COLUMN status TEXT DEFAULT 'sent' CHECK(status IN ('sent', 'read'));`)
  } catch (_) {}

  // Cashiers table (belong to a user — Manufacturer or Reseller)
  db.exec(`
    CREATE TABLE IF NOT EXISTS cashiers (
      id          TEXT PRIMARY KEY,
      owner_id    TEXT NOT NULL,
      name        TEXT NOT NULL,
      phone       TEXT NOT NULL UNIQUE,
      password    TEXT NOT NULL,
      plain_password TEXT,
      status      TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active', 'Inactive')),
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `)

  try { db.exec(`ALTER TABLE cashiers ADD COLUMN plain_password TEXT;`) } catch (_) {}
  try { db.exec(`UPDATE cashiers SET plain_password = NULL`) } catch (_) {}

  // Cutters table (belong to a Manufacturer user)
  db.exec(`
    CREATE TABLE IF NOT EXISTS cutters (
      id          TEXT PRIMARY KEY,
      owner_id    TEXT NOT NULL,
      name        TEXT NOT NULL,
      phone       TEXT NOT NULL UNIQUE,
      password    TEXT NOT NULL,
      plain_password TEXT,
      status      TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active', 'Inactive')),
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `)

  try { db.exec(`ALTER TABLE cutters ADD COLUMN plain_password TEXT;`) } catch (_) {}
  try { db.exec(`UPDATE cutters SET plain_password = NULL`) } catch (_) {}

  // Sales table (recorded by a cashier)
  db.exec(`
    CREATE TABLE IF NOT EXISTS sales (
      id           TEXT PRIMARY KEY,
      cashier_id   TEXT NOT NULL,
      owner_id     TEXT NOT NULL,
      customer     TEXT,
      payment_type TEXT NOT NULL DEFAULT 'Cash' CHECK(payment_type IN ('Cash', 'Credit')),
      total_amount REAL NOT NULL DEFAULT 0,
      note         TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (cashier_id) REFERENCES cashiers(id) ON DELETE CASCADE
    );
  `)

  // Sale items
  db.exec(`
    CREATE TABLE IF NOT EXISTS sale_items (
      id           TEXT PRIMARY KEY,
      sale_id      TEXT NOT NULL,
      material     TEXT NOT NULL,
      quantity     REAL NOT NULL,
      unit_price   REAL NOT NULL,
      total        REAL NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
    );
  `)

  // Credits table (created whenever a Credit sale is recorded, or an owner issues credit directly)
  db.exec(`
    CREATE TABLE IF NOT EXISTS credits (
      id           TEXT PRIMARY KEY,
      sale_id      TEXT UNIQUE,
      cashier_id   TEXT,
      owner_id     TEXT NOT NULL,
      customer     TEXT NOT NULL DEFAULT 'Unknown',
      total_amount REAL NOT NULL DEFAULT 0,
      total_paid   REAL NOT NULL DEFAULT 0,
      note         TEXT,
      issued_by    TEXT NOT NULL DEFAULT 'cashier' CHECK(issued_by IN ('cashier', 'owner')),
      issued_by_id TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (sale_id)    REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY (cashier_id) REFERENCES cashiers(id) ON DELETE CASCADE
    );
  `)

  // Migrate older credit table format to support owner-issued credits
  try {
    const hasIssuedBy = db.prepare("PRAGMA table_info('credits')").all().some(col => col.name === 'issued_by')
    if (!hasIssuedBy) {
      db.exec(`ALTER TABLE credits ADD COLUMN issued_by TEXT DEFAULT 'cashier';`)
      db.exec(`ALTER TABLE credits ADD COLUMN issued_by_id TEXT;`)
    }
  } catch (_) {}

  // Credit payments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS credit_payments (
      id         TEXT PRIMARY KEY,
      credit_id  TEXT NOT NULL,
      amount     REAL NOT NULL,
      note       TEXT,
      paid_at    TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (credit_id) REFERENCES credits(id) ON DELETE CASCADE
    );
  `)

  // Materials table (Stock created by Reseller / Manufacturer)
  db.exec(`
    CREATE TABLE IF NOT EXISTS materials (
      id               TEXT PRIMARY KEY,
      user_id          TEXT NOT NULL,
      name             TEXT NOT NULL,
      quantity         REAL NOT NULL DEFAULT 0,
      initial_quantity REAL NOT NULL DEFAULT 0,
      unit             TEXT NOT NULL CHECK(unit IN ('Meter', 'Piece', 'Kilogram')),
      unit_price       REAL NOT NULL DEFAULT 0,
      created_at       TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `)

  // Replenishment requests created by cashiers.
  db.exec(`
    CREATE TABLE IF NOT EXISTS material_orders (
      id             TEXT PRIMARY KEY,
      owner_id       TEXT NOT NULL,
      requester_id   TEXT NOT NULL,
      requester_role TEXT NOT NULL DEFAULT 'Cashier',
      material_id    TEXT,
      material_name  TEXT NOT NULL,
      quantity       REAL NOT NULL,
      note           TEXT,
      status         TEXT NOT NULL DEFAULT 'Pending'
                     CHECK(status IN ('Pending', 'Approved', 'Fulfilled', 'Rejected')),
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE SET NULL
    );
  `)

  // Cutting records: raw material consumed and cloth produced by a cutter.
  db.exec(`
    CREATE TABLE IF NOT EXISTS cutting_records (
      id                 TEXT PRIMARY KEY,
      material_id        TEXT NOT NULL,
      owner_id           TEXT NOT NULL,
      cutter_id          TEXT,
      material_name      TEXT NOT NULL,
      consumed_quantity  REAL NOT NULL,
      produced_cloth     REAL NOT NULL,
      output_material_id TEXT,
      output_material_name TEXT NOT NULL,
      waste_quantity     REAL NOT NULL DEFAULT 0,
      note               TEXT,
      created_at         TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (cutter_id) REFERENCES cutters(id) ON DELETE SET NULL
    );
  `)

  try { db.exec(`ALTER TABLE cutting_records ADD COLUMN output_material_id TEXT;`) } catch (_) {}
  try { db.exec(`ALTER TABLE cutting_records ADD COLUMN output_material_name TEXT DEFAULT 'Finished Cloth';`) } catch (_) {}

  // Migration for initial_quantity column if adding to existing database
  try {
    db.exec("ALTER TABLE materials ADD COLUMN initial_quantity REAL DEFAULT 0;")
  } catch (_) {}
  db.exec("UPDATE materials SET initial_quantity = quantity WHERE initial_quantity = 0 OR initial_quantity IS NULL;")

  // Migration: initial_price (cost/purchase price), image_url, colors (JSON), Kilogram unit
  try { db.exec("ALTER TABLE materials ADD COLUMN initial_price REAL DEFAULT 0;") } catch (_) {}
  try { db.exec("ALTER TABLE materials ADD COLUMN image_url TEXT;") } catch (_) {}
  try { db.exec("ALTER TABLE materials ADD COLUMN colors TEXT DEFAULT '[]';") } catch (_) {}
  // Extend unit CHECK — update existing rows with bad unit value is safe; constraint only enforced on new rows
  // We recreate the table or just relax the constraint via migration drop-and-add is not needed;
  // instead use a soft check in service layer for Kilogram

  // Refresh tokens table
  db.exec(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id          TEXT PRIMARY KEY,
      token       TEXT NOT NULL UNIQUE,
      admin_id    TEXT NOT NULL,
      expires_at  TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
    );
  `)

  // Add status column to admins if it doesn't exist (migration)
  try {
    db.exec(`ALTER TABLE admins ADD COLUMN status TEXT NOT NULL DEFAULT 'Active';`)
  } catch (_) {}

  try { db.exec(`UPDATE admins SET plain_password = NULL`) } catch (_) {}

  // Super admins table
  db.exec(`
    CREATE TABLE IF NOT EXISTS super_admins (
      id          TEXT PRIMARY KEY,
      phone       TEXT NOT NULL UNIQUE,
      password    TEXT NOT NULL,
      name        TEXT NOT NULL DEFAULT 'Super Admin',
      status      TEXT NOT NULL DEFAULT 'Active',
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  try {
    db.exec(`ALTER TABLE super_admins ADD COLUMN status TEXT NOT NULL DEFAULT 'Active';`)
  } catch (_) {}
  try {
    db.exec(`ALTER TABLE super_admins ADD COLUMN email TEXT;`)
  } catch (_) {}

  // Super admin refresh tokens
  db.exec(`
    CREATE TABLE IF NOT EXISTS super_admin_tokens (
      id              TEXT PRIMARY KEY,
      token           TEXT NOT NULL UNIQUE,
      super_admin_id  TEXT NOT NULL,
      expires_at      TEXT NOT NULL,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (super_admin_id) REFERENCES super_admins(id) ON DELETE CASCADE
    );
  `)

  // Global app settings such as registration fee, tax, and other company-level values.
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id          TEXT PRIMARY KEY,
      setting_key TEXT NOT NULL UNIQUE,
      setting_value TEXT NOT NULL,
      description TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  // Registration requests for paid plan approvals
  db.exec(`
    CREATE TABLE IF NOT EXISTS registration_requests (
      id               TEXT PRIMARY KEY,
      user_id          TEXT NOT NULL,
      name             TEXT NOT NULL,
      phone            TEXT NOT NULL,
      role             TEXT NOT NULL,
      plan_key         TEXT NOT NULL,
      plan_label       TEXT NOT NULL,
      fee              NUMERIC NOT NULL DEFAULT 0,
      status           TEXT NOT NULL DEFAULT 'Pending',
      telegram_username TEXT,
      account_detail   TEXT,
      rejection_reason TEXT,
      created_at       TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  // Dedicated Payment Accounts table in database
  db.exec(`
    CREATE TABLE IF NOT EXISTS payment_accounts (
      id             TEXT PRIMARY KEY,
      bank           TEXT NOT NULL,
      account_name   TEXT NOT NULL,
      account_number TEXT NOT NULL,
      is_active      BOOLEAN NOT NULL DEFAULT TRUE,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  try { db.exec(`ALTER TABLE registration_requests ADD COLUMN telegram_username TEXT;`) } catch (_) {}
  try { db.exec(`ALTER TABLE registration_requests ADD COLUMN account_detail TEXT;`) } catch (_) {}

  // ── Seed the 5 fixed business groups if they don't exist yet ─────────────
  const FIXED_GROUPS = [
    { id: 'group-cherk',          name: 'Cherk',                description: 'Cherk community group' },
    { id: 'group-general',        name: 'Textile',              description: 'Textile materials and products' },
    { id: 'group-business',       name: 'Accessory',            description: 'Accessories and supplies' },
    { id: 'group-support',        name: 'Manufacturing',        description: 'Manufacturing and production' },
    { id: 'group-boutique-garment', name: 'Boutique and Garment', description: 'Boutique and garment business' },
  ]
  const superAdminRow = db.prepare('SELECT id FROM super_admins ORDER BY created_at ASC LIMIT 1').get()
  const seedCreatedBy = superAdminRow ? superAdminRow.id : 'system'
  for (const g of FIXED_GROUPS) {
    try {
      db.prepare(`
        INSERT INTO chat_groups (id, name, description, created_by, created_at)
        VALUES (?, ?, ?, ?, NOW())
        ON CONFLICT (id) DO NOTHING
      `).run(g.id, g.name, g.description, seedCreatedBy)
    } catch (_) {}
  }
  for (const g of FIXED_GROUPS) {
    try {
      db.prepare('UPDATE chat_groups SET name = ?, description = ? WHERE id = ?')
        .run(g.name, g.description, g.id)
    } catch (_) {}
  }

  console.log('[DB] Tables created or already exist.')

  // ── Migrations ────────────────────────────────────────────────────────────
  // Ensure email column exists on admins table
  try {
    db.exec(`ALTER TABLE admins ADD COLUMN email TEXT;`)
    console.log('[DB] Migration: added email to admins')
  } catch (_) {}

  // Add material_id column to sale_items for reliable stock deduction by ID
  try {
    db.exec(`ALTER TABLE sale_items ADD COLUMN material_id TEXT;`)
    console.log('[DB] Migration: added material_id to sale_items')
  } catch (_) {}

  // Verify that the PostgreSQL materials metadata is available.
  try {
    const unitCheck = db.prepare(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'materials' AND column_name = 'unit'
    `).get()
    if (unitCheck) {
      console.log('[DB] Postgres materials table is ready for Kilogram values when used by the app layer.')
    }
  } catch (_) {}
}

module.exports = { createTables }
