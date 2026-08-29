const db = require('../database/db')
const { v4: uuid } = require('uuid')

const MaterialModel = {
  create({ userId, name, quantity, unit, unitPrice, initialPrice, images, colors }) {
    const id = uuid()
    const colorsJson = JSON.stringify(colors || [])
    // Store images as JSON array string
    const imagesJson = JSON.stringify(images && images.length ? images : [])
    db.prepare(`
      INSERT INTO materials (id, user_id, name, quantity, initial_quantity, unit, unit_price, initial_price, image_url, colors)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, name, quantity, quantity, unit, unitPrice, initialPrice || 0, imagesJson, colorsJson)

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

  // Get materials below custom threshold percentage
  findLowStockWithThreshold(userId, thresholdPercentage = 20) {
    const threshold = (thresholdPercentage || 20) / 100
    return db.prepare(`
      SELECT * FROM materials
      WHERE user_id = ?
        AND (
          (initial_quantity > 0 AND (quantity * 1.0 / initial_quantity) <= ?)
          OR (initial_quantity = 0 AND quantity <= 5)
        )
      ORDER BY quantity ASC
    `).all(userId, threshold).map(MaterialModel._parse)
  },

  update(id, userId, { name, quantity, unit, unitPrice, initialPrice, images, colors }) {
    const colorsJson = JSON.stringify(colors || [])
    const imagesJson = JSON.stringify(images && images.length ? images : [])
    const result = db.prepare(`
      UPDATE materials
      SET name = ?, unit_price = ?, initial_price = ?, image_url = ?, colors = ?, unit = ?
      WHERE id = ? AND user_id = ?
    `).run(name, unitPrice, initialPrice ?? 0, imagesJson, colorsJson, unit, id, userId)
    if (result.changes === 0) return null
    return MaterialModel.findById(id)
  },

  delete(id, userId) {
    return db.prepare('DELETE FROM materials WHERE id = ? AND user_id = ?').run(id, userId)
  },

  // Parse colors and images JSON strings back to arrays
  _parse(row) {
    let colors = []
    try { colors = JSON.parse(row.colors || '[]') } catch (_) {}

    // images: stored as JSON array in image_url column
    let images = []
    if (row.image_url) {
      if (row.image_url.startsWith('[')) {
        try { images = JSON.parse(row.image_url) } catch (_) { images = [row.image_url] }
      } else if (row.image_url.length > 0) {
        images = [row.image_url]
      }
    }

    return { ...row, colors, images, image_url: images[0] || null }
  },
}

module.exports = MaterialModel
