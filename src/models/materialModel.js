const db = require('../database/db')
const { v4: uuid } = require('uuid')

const MaterialModel = {
  create({ userId, name, quantity, unit, unitPrice }) {
    const id = uuid()
    db.prepare(`
      INSERT INTO materials (id, user_id, name, quantity, initial_quantity, unit, unit_price)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, name, quantity, quantity, unit, unitPrice)

    return MaterialModel.findById(id)
  },

  findById(id) {
    return db.prepare('SELECT * FROM materials WHERE id = ?').get(id)
  },

  findByUser(userId) {
    return db.prepare('SELECT * FROM materials WHERE user_id = ? ORDER BY created_at DESC').all(userId)
  },

  // Used by cashiers — fetch owner's materials
  findByOwner(ownerId) {
    return db.prepare('SELECT * FROM materials WHERE user_id = ? ORDER BY name ASC').all(ownerId)
  },

  // Get materials at or below 20% of initial_quantity
  findLowStock(userId) {
    return db.prepare(`
      SELECT * FROM materials
      WHERE user_id = ?
        AND (
          (initial_quantity > 0 AND (quantity * 1.0 / initial_quantity) <= 0.20)
          OR (initial_quantity = 0 AND quantity <= 5)
        )
      ORDER BY quantity ASC
    `).all(userId)
  },

  delete(id, userId) {
    return db.prepare('DELETE FROM materials WHERE id = ? AND user_id = ?').run(id, userId)
  },
}

module.exports = MaterialModel
