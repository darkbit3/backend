const saleService = require('../services/sale_service')

const saleController = {
  // POST /api/sales
  async create(req, res, next) {
    try {
      const { customer, paymentType, note, items } = req.body
      const cashierId = req.user.id
      const ownerId   = req.user.owner_id
      const { sale, lowStockAlerts } = saleService.create(cashierId, ownerId, { customer, paymentType, note, items })
      res.status(201).json({ success: true, message: 'Sale recorded', data: sale, lowStockAlerts })
    } catch (err) {
      next(err)
    }
  },

  // GET /api/sales  (cashier sees own sales)
  list(req, res, next) {
    try {
      const data = saleService.listByCashier(req.user.id)
      res.json({ success: true, data })
    } catch (err) {
      next(err)
    }
  },

  // GET /api/sales/stats
  stats(req, res, next) {
    try {
      const data = saleService.stats(req.user.id)
      res.json({ success: true, data })
    } catch (err) {
      next(err)
    }
  },

  // GET /api/sales/owner
  listOwnerSales(req, res, next) {
    try {
      const data = saleService.listByOwner(req.user.id)
      res.json({ success: true, data })
    } catch (err) {
      next(err)
    }
  },
}

module.exports = saleController
