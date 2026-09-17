const db = require('../database/db')
const { v4: uuid } = require('uuid')

const MaterialOrderModel = {
  create({ ownerId, requesterId, materialId, materialName, quantity, note }) {
    const id = uuid()
    db.prepare(`
      INSERT INTO material_orders
        (id, owner_id, requester_id, requester_role, material_id, material_name, quantity, note)
      VALUES (?, ?, ?, 'Cashier', ?, ?, ?, ?)
    `).run(id, ownerId, requesterId, materialId || null, materialName, quantity, note || null)
    return MaterialOrderModel.findById(id)
  },

  findById(id) {
    return db.prepare('SELECT * FROM material_orders WHERE id = ?').get(id)
  },

  findForOwner(ownerId) {
    return db.prepare(`
      SELECT mo.*, COALESCE(c.name, mo.requester_id) AS requester_name
      FROM material_orders mo
      LEFT JOIN cashiers c ON c.id = mo.requester_id
      WHERE mo.owner_id = ?
      ORDER BY mo.created_at DESC
    `).all(ownerId)
  },

  findForRequester(requesterId) {
    return db.prepare('SELECT * FROM material_orders WHERE requester_id = ? ORDER BY created_at DESC').all(requesterId)
  },

  updateStatus(id, ownerId, status) {
    const result = db.prepare(`
      UPDATE material_orders SET status = ?, updated_at = datetime('now')
      WHERE id = ? AND owner_id = ?
    `).run(status, id, ownerId)
    return result.changes ? MaterialOrderModel.findById(id) : null
  },
}

module.exports = MaterialOrderModel
