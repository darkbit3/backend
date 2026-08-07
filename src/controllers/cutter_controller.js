const cutterService = require('../services/cutter_service')

const cutterController = {
  // GET /api/cutters
  getAll(req, res, next) {
    try {
      const data = cutterService.getAll(req.user.id)
      res.json({ success: true, data })
    } catch (err) {
      next(err)
    }
  },

  // POST /api/cutters
  async create(req, res, next) {
    try {
      const { name, phone, password } = req.body
      const data = await cutterService.create({
        ownerId: req.user.id,
        name,
        phone,
        password,
      })
      res.status(201).json({ success: true, message: 'Cutter created', data })
    } catch (err) {
      next(err)
    }
  },

  // PATCH /api/cutters/:id/status
  updateStatus(req, res, next) {
    try {
      const data = cutterService.updateStatus(req.params.id, req.user.id, req.body.status)
      res.json({ success: true, message: `Status updated to ${req.body.status}`, data })
    } catch (err) {
      next(err)
    }
  },

  // PUT /api/cutters/:id
  async update(req, res, next) {
    try {
      const { name, phone } = req.body
      const data = await cutterService.update(req.params.id, req.user.id, { name, phone })
      res.json({ success: true, message: 'Cutter updated', data })
    } catch (err) {
      next(err)
    }
  },

  // PATCH /api/cutters/:id/reset-password
  async resetPassword(req, res, next) {
    try {
      const data = await cutterService.resetPassword(req.params.id, req.user.id, req.body.password)
      res.json({ success: true, message: 'Password reset successfully', data })
    } catch (err) {
      next(err)
    }
  },
}

module.exports = cutterController
