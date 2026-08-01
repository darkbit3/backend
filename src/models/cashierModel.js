const db = require('../database/db')

const CashierModel = {
  /** All cashiers belonging to a specific owner (user). */
  findAllByOwner(ownerId) {
    return db
      .prepare(
        `SELECT id, owner_id, name, phone, plain_password, status, created_at
         FROM cashiers
         WHERE owner_id = ?
         ORDER BY created_at DESC`
      )
      .all(ownerId)
  },

  findById(id) {
    return db
      .prepare(
        `SELECT id, owner_id, name, phone, plain_password, status, created_at
         FROM cashiers WHERE id = ?`
      )
      .get(id)
  },

  findByPhone(phone) {
    return db.prepare('SELECT * FROM cashiers WHERE phone = ?').get(phone)
  },

  create({ id, ownerId, name, phone, password, plainPassword }) {
    return db
      .prepare(
        `INSERT INTO cashiers (id, owner_id, name, phone, password, plain_password, status)
         VALUES (?, ?, ?, ?, ?, ?, 'Active')`
      )
      .run(id, ownerId, name, phone, password, plainPassword)
  },

  updateStatus(id, status) {
    return db
      .prepare(`UPDATE cashiers SET status = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(status, id)
  },

  update(id, { name, phone }) {
    return db
      .prepare(`UPDATE cashiers SET name = ?, phone = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(name, phone, id)
  },

  updatePassword(id, hash, plainPassword) {
    return db
      .prepare(`UPDATE cashiers SET password = ?, plain_password = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(hash, plainPassword, id)
  },
}

module.exports = CashierModel
