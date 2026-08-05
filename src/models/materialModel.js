const db = require('../database/db')
const { v4: uuid } = require('uuid')

const MaterialModel = {
  create({ userId, name, quantity, unit, unitPrice, initialPrice, imageUrl, colors }) {
    const id = uuid()
    const colorsJson = JSON.stringify(colors || [])
    db.prepare(`
      INSERT INTO materials (id, user_id, name, quantity, initial_quantity, unit, unit_price, initial_price, image_url, colors)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, name, quantity, quantity, unit, unitPrice, initialPrice || 0, imageUrl || null, colorsJson)

    return MaterialModel.findById(id)
  },

  findById(id) {
    const row = db.prepare('SELECT * FROM materials WHERE id = ?').get(id)
    return row ? MaterialModel._parse(row) : null
  },

  findByUser(userId) {
    return db.prepare('SELECT * FROM materials WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId).map(MaterialModel._parse)
  },

  // Used by cashiers — fetch owner's materials
  findByOwner(ownerId) {
    return db.prepare('SELECT * FROM materials WHERE user_id = ? ORDER BY name ASC')
      .all(ownerId).map(MaterialModel._parse)
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
    `).all(userId).map(MaterialModel._parse)
  },

  delete(id, userId) {
    return db.prepare('DELETE FROM materials WHERE id = ? AND user_id = ?').run(id, userId)
  },

  // Parse colors JSON string back to array
  _parse(row) {
    let colors = []
    try { colors = JSON.parse(row.colors || '[]') } catch (_) {}
    return { ...row, colors }
  },
}

module.exports = MaterialModel
