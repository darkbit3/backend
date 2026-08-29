const creditService = require('../services/credit_service')

const creditController = {
  // POST /api/credits — direct credit entry by Manufacturer / Reseller owner
  create(req, res, next) {
    try {
      const isOwnerUser = !req.user.owner_id || req.user.owner_id === req.user.id
      if (!isOwnerUser) {
        return res.status(403).json({ success: false, message: 'Only owners/manufacturers/resellers can issue direct credit' })
      }

      const { customer, amount, note } = req.body
      const data = creditService.recordCredit(req.user.id, { customer, amount, note })
      res.status(201).json({ success: true, data })
    } catch (err) {
      if (err.status) return res.status(err.status).json({ success: false, message: err.message })
      next(err)
    }
  },

  // GET /api/credits  — cashier sees own credits
  listMine(req, res, next) {
    try {
      const data = creditService.listByCashier(req.user.id)
      res.json({ success: true, data })
    } catch (err) { next(err) }
  },

  // GET /api/credits/owner  — owner sees all credits from their cashiers
  listOwner(req, res, next) {
    try {
      const ownerId = req.user.owner_id || req.user.id
      const data = creditService.listByOwner(ownerId)
      res.json({ success: true, data })
    } catch (err) { next(err) }
  },

  // GET /api/credits/owner/stats  — owner dashboard summary
  ownerStats(req, res, next) {
    try {
      const ownerId = req.user.owner_id || req.user.id
      const data = creditService.statsByOwner(ownerId)
      res.json({ success: true, data })
    } catch (err) { next(err) }
  },

  // POST /api/credits/:id/payments  — add a payment installment
  async addPayment(req, res, next) {
    try {
      const { id } = req.params
      const { amount, note } = req.body
      const updated = creditService.addPayment(id, req.user.id, { amount, note })
      res.json({ success: true, data: updated })
    } catch (err) {
      if (err.status) return res.status(err.status).json({ success: false, message: err.message })
      next(err)
    }
  },
}

module.exports = creditController
