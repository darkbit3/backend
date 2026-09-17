const db = require('../database/db')
const MaterialOrderModel = require('../models/materialOrderModel')
const VALID_STATUSES = ['Pending', 'Approved', 'Fulfilled', 'Rejected']

const materialOrderService = {
  create(requesterId, ownerId, { materialId, materialName, quantity, note }) {
    const amount = parseFloat(quantity)
    if (!materialName || !String(materialName).trim()) throw { status: 400, message: 'Material name is required.' }
    if (!Number.isFinite(amount) || amount <= 0) throw { status: 400, message: 'Requested quantity must be greater than zero.' }
    if (materialId && !db.prepare('SELECT id FROM materials WHERE id = ? AND user_id = ?').get(materialId, ownerId)) {
      throw { status: 404, message: 'Material not found for this owner.' }
    }
    return MaterialOrderModel.create({ ownerId, requesterId, materialId, materialName: String(materialName).trim(), quantity: amount, note })
  },

  listForOwner(ownerId) { return MaterialOrderModel.findForOwner(ownerId) },
  listForRequester(requesterId) { return MaterialOrderModel.findForRequester(requesterId) },

  updateStatus(id, ownerId, status) {
    if (!VALID_STATUSES.includes(status)) throw { status: 400, message: 'Invalid order status.' }
    const updated = MaterialOrderModel.updateStatus(id, ownerId, status)
    if (!updated) throw { status: 404, message: 'Order not found or access denied.' }
    return updated
  },
}

module.exports = materialOrderService
