const db = require('./db')

function createTables() {
  // Admins table (for admin panel login)
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id          TEXT PRIMARY KEY,
      phone       TEXT NOT NULL UNIQUE,
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

  // Credits table (created whenever a Credit sale is recorded)
  db.exec(`
    CREATE TABLE IF NOT EXISTS credits (
      id           TEXT PRIMARY KEY,
      sale_id      TEXT NOT NULL UNIQUE,
      cashier_id   TEXT NOT NULL,
      owner_id     TEXT NOT NULL,
      customer     TEXT NOT NULL DEFAULT 'Unknown',
      total_amount REAL NOT NULL DEFAULT 0,
      total_paid   REAL NOT NULL DEFAULT 0,
      note         TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (sale_id)    REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY (cashier_id) REFERENCES cashiers(id) ON DELETE CASCADE
    );
  `)

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
      unit             TEXT NOT NULL CHECK(unit IN ('Meter', 'Piece')),
      unit_price       REAL NOT NULL DEFAULT 0,
      created_at       TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `)

  // Migration for initial_quantity column if adding to existing database
  try {
    db.exec("ALTER TABLE materials ADD COLUMN initial_quantity REAL DEFAULT 0;")
  } catch (_) {}
  db.exec("UPDATE materials SET initial_quantity = quantity WHERE initial_quantity = 0 OR initial_quantity IS NULL;")

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

  console.log('[DB] Tables created or already exist.')
}

module.exports = { createTables }
