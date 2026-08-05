require('dotenv').config()
const db = require('./src/database/db')

db.exec(`
  BEGIN;

  CREATE TABLE IF NOT EXISTS materials_new (
    id               TEXT PRIMARY KEY,
    user_id          TEXT NOT NULL,
    name             TEXT NOT NULL,
    quantity         REAL NOT NULL DEFAULT 0,
    initial_quantity REAL NOT NULL DEFAULT 0,
    unit             TEXT NOT NULL CHECK(unit IN ('Meter', 'Piece', 'Kilogram')),
    unit_price       REAL NOT NULL DEFAULT 0,
    initial_price    REAL NOT NULL DEFAULT 0,
    image_url        TEXT,
    colors           TEXT DEFAULT '[]',
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  INSERT INTO materials_new (id, user_id, name, quantity, initial_quantity, unit, unit_price, initial_price, image_url, colors, created_at)
  SELECT id, user_id, name, quantity, initial_quantity, unit, unit_price,
         COALESCE(initial_price, 0),
         image_url,
         COALESCE(colors, '[]'),
         created_at
  FROM materials;

  DROP TABLE materials;
  ALTER TABLE materials_new RENAME TO materials;

  COMMIT;
`)

console.log('Materials table recreated with Kilogram unit support.')
const count = db.prepare('SELECT COUNT(*) as n FROM materials').get()
console.log('Existing rows preserved:', count.n)
