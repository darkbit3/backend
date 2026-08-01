const SaleModel     = require('../models/saleModel')
const MaterialModel = require('../models/materialModel')
const db            = require('../database/db')

const saleService = {
  create(cashierId, ownerId, { customer, paymentType = 'Cash', note, items }) {
    if (!items || items.length === 0) {
      throw { status: 400, message: 'At least one item is required' }
    }
    if (!ownerId) {
      const cashier = db.prepare('SELECT owner_id FROM cashiers WHERE id = ?').get(cashierId)
      ownerId = cashier ? cashier.owner_id : cashierId
    }
    const processedItems = items.map(i => ({
      material:  i.material?.trim(),
      quantity:  parseFloat(i.quantity),
      unitPrice: parseFloat(i.unitPrice),
      total:     parseFloat(i.quantity) * parseFloat(i.unitPrice),
    }))
    const totalAmount = processedItems.reduce((s, i) => s + i.total, 0)
    const sale = SaleModel.create({ cashierId, ownerId, customer, paymentType, totalAmount, note, items: processedItems })

    // Check low stock materials for this owner (<= 20% remaining)
    const lowStock = MaterialModel.findLowStock(ownerId)

    return {
      sale,
      lowStockAlerts: lowStock.map(m => ({
        id:              m.id,
        name:            m.name,
        remaining:       m.quantity,
        initialQuantity: m.initial_quantity,
        unit:            m.unit,
        percentage:      m.initial_quantity > 0 ? (m.quantity / m.initial_quantity) * 100 : 0,
      })),
    }
  },

  listByCashier(cashierId) {
    return SaleModel.findByCashier(cashierId)
  },

  listByOwner(ownerId) {
    return SaleModel.findByOwner(ownerId)
  },

  stats(cashierId) {
    return SaleModel.statsByCashier(cashierId)
  },
}

module.exports = saleService
