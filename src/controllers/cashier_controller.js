const cashierService = require('../services/cashier_service')

const cashierController = {
  // GET /api/cashiers  — list all cashiers for the logged-in user
  getAll(req, res, next) {
    try {
      const data = cashierService.getAll(req.user.id)
      res.json({ success: true, data })
    } catch (err) {
      next(err)
    }
  },

  // POST /api/cashiers  — create a new cashier under the logged-in user
  async create(req, res, next) {
    try {
      const { name, phone, password } = req.body
      const data = await cashierService.create({
        ownerId: req.user.id,
        name,
        phone,
        password,
      })
      res.status(201).json({ success: true, message: 'Cashier created', data })
    } catch (err) {
      next(err)
    }
  },

  // PATCH /api/cashiers/:id/status
  updateStatus(req, res, next) {
    try {
      const data = cashierService.updateStatus(req.params.id, req.user.id, req.body.status)
      res.json({ success: true, message: `Status updated to ${req.body.status}`, data })
    } catch (err) {
      next(err)
    }
  },

  // PUT /api/cashiers/:id
  async update(req, res, next) {
    try {
      const { name, phone } = req.body
      const data = await cashierService.update(req.params.id, req.user.id, { name, phone })
      res.json({ success: true, message: 'Cashier updated', data })
    } catch (err) {
      next(err)
    }
  },

  // PATCH /api/cashiers/:id/reset-password
  async resetPassword(req, res, next) {
    try {
      const data = await cashierService.resetPassword(req.params.id, req.user.id, req.body.password)
      res.json({ success: true, message: 'Password reset successfully', data })
    } catch (err) {
      next(err)
    }
  },
}

module.exports = cashierController

