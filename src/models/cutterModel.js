const db = require('../database/db')

const CutterModel = {
  findAllByOwner(ownerId) {
    return db.prepare(
      `SELECT id, owner_id, name, phone, plain_password, status, created_at
       FROM cutters
       WHERE owner_id = ?
       ORDER BY created_at DESC`
    ).all(ownerId)
  },

  findById(id) {
    return db.prepare(
      `SELECT id, owner_id, name, phone, plain_password, status, created_at
       FROM cutters WHERE id = ?`
    ).get(id)
  },

  findByPhone(phone) {
    return db.prepare('SELECT * FROM cutters WHERE phone = ?').get(phone)
  },

  create({ id, ownerId, name, phone, password, plainPassword }) {
    return db.prepare(
      `INSERT INTO cutters (id, owner_id, name, phone, password, plain_password, status)
       VALUES (?, ?, ?, ?, ?, ?, 'Active')`
    ).run(id, ownerId, name, phone, password, plainPassword)
  },

  updateStatus(id, status) {
    return db.prepare(
      `UPDATE cutters SET status = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(status, id)
  },

  update(id, { name, phone }) {
    return db.prepare(
      `UPDATE cutters SET name = ?, phone = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(name, phone, id)
  },

  updatePassword(id, hash, plainPassword) {
    return db.prepare(
      `UPDATE cutters SET password = ?, plain_password = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(hash, plainPassword, id)
  },
}

module.exports = CutterModel
