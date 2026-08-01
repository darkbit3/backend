const MaterialModel = require('../models/materialModel')

const materialService = {
  create(userId, { name, quantity, unit, unitPrice }) {
    if (!name || !name.trim()) {
      throw { status: 400, message: 'Material name is required.' }
    }
    const qty = parseFloat(quantity)
    if (isNaN(qty) || qty <= 0) {
      throw { status: 400, message: 'Quantity must be a positive number.' }
    }
    const price = parseFloat(unitPrice)
    if (isNaN(price) || price < 0) {
      throw { status: 400, message: 'Unit price must be a non-negative number.' }
    }
    const validUnits = ['Meter', 'Piece']
    if (!validUnits.includes(unit)) {
      throw { status: 400, message: 'Unit must be Meter or Piece.' }
    }

    return MaterialModel.create({
      userId,
      name: name.trim(),
      quantity: qty,
      unit,
      unitPrice: price,
    })
  },

  listForUser(userId) {
    return MaterialModel.findByUser(userId)
  },

  // For cashiers: fetch their owner's materials
  listForOwner(ownerId) {
    return MaterialModel.findByOwner(ownerId)
  },

  delete(materialId, userId) {
    const result = MaterialModel.delete(materialId, userId)
    if (result.changes === 0) {
      throw { status: 404, message: 'Material not found or access denied.' }
    }
    return { deleted: true }
  },
}

module.exports = materialService
