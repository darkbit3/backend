const adminManageService = require('../services/admin_manage_service')

const adminManageController = {
  // GET /api/users/stats
  getStats(req, res, next) {
    try {
      const data = adminManageService.getStats()
      res.json({ success: true, data })
    } catch (err) {
      next(err)
    }
  },

  // GET /api/users
  getAll(req, res, next) {
    try {
      const data = adminManageService.getAll()
      res.json({ success: true, data })
    } catch (err) {
      next(err)
    }
  },

  // GET /api/users/:id
  getOne(req, res, next) {
    try {
      const data = adminManageService.getOne(req.params.id)
      res.json({ success: true, data })
    } catch (err) {
      next(err)
    }
  },

  // GET /api/users/:id/password
  getPassword(req, res, next) {
    try {
      const password = adminManageService.getPassword(req.params.id)
      res.json({ success: true, data: { password } })
    } catch (err) {
      next(err)
    }
  },

  // POST /api/users
  async create(req, res, next) {
    try {
      const data = await adminManageService.create(req.body)
      res.status(201).json({ success: true, message: 'User created', data })
    } catch (err) {
      next(err)
    }
  },

  // PUT /api/users/:id
  update(req, res, next) {
    try {
      const data = adminManageService.update(req.params.id, req.body)
      res.json({ success: true, message: 'User updated', data })
    } catch (err) {
      next(err)
    }
  },

  // DELETE /api/users/:id
  delete(req, res, next) {
    try {
      adminManageService.delete(req.params.id)
      res.json({ success: true, message: 'User deleted' })
    } catch (err) {
      next(err)
    }
  },

  // PATCH /api/users/:id/status
  updateStatus(req, res, next) {
    try {
      adminManageService.updateStatus(req.params.id, req.body.status)
      res.json({ success: true, message: `Status updated to ${req.body.status}` })
    } catch (err) {
      next(err)
    }
  },

  // PATCH /api/users/:id/reset-password
  async resetPassword(req, res, next) {
    try {
      await adminManageService.resetPassword(req.params.id, req.body.password)
      res.json({ success: true, message: 'Password reset successfully' })
    } catch (err) {
      next(err)
    }
  },

  // POST /api/users/bulk/delete
  bulkDelete(req, res, next) {
    try {
      adminManageService.bulkDelete(req.body.ids)
      res.json({ success: true, message: `${req.body.ids.length} user(s) deleted` })
    } catch (err) {
      next(err)
    }
  },

  // POST /api/users/bulk/status
  bulkStatus(req, res, next) {
    try {
      adminManageService.bulkStatus(req.body.ids, req.body.status)
      res.json({ success: true, message: `${req.body.ids.length} user(s) updated to ${req.body.status}` })
    } catch (err) {
      next(err)
    }
  },

  // POST /api/users/bulk/reset-password
  async bulkResetPassword(req, res, next) {
    try {
      await adminManageService.bulkResetPassword(req.body.ids, req.body.password)
      res.json({ success: true, message: `Password reset for ${req.body.ids.length} user(s)` })
    } catch (err) {
      next(err)
    }
  },
}

module.exports = adminManageController
