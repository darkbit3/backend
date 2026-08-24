const superAdminManageService = require('../services/super_admin_manage_service')

const superAdminManageController = {
  // GET /api/super/admins/stats
  getStats(req, res, next) {
    try {
      const data = superAdminManageService.getStats()
      res.json({ success: true, data })
    } catch (err) {
      next(err)
    }
  },

  // GET /api/super/admins
  getAll(req, res, next) {
    try {
      const data = superAdminManageService.getAll()
      res.json({ success: true, data })
    } catch (err) {
      next(err)
    }
  },

  // GET /api/super/admins/:id
  getOne(req, res, next) {
    try {
      const data = superAdminManageService.getOne(req.params.id)
      res.json({ success: true, data })
    } catch (err) {
      next(err)
    }
  },

  // POST /api/super/admins
  async create(req, res, next) {
    try {
      const data = await superAdminManageService.create(req.body)
      res.status(201).json({ success: true, message: 'Admin created', data })
    } catch (err) {
      next(err)
    }
  },

  // PUT /api/super/admins/:id
  update(req, res, next) {
    try {
      const data = superAdminManageService.update(req.params.id, req.body)
      res.json({ success: true, message: 'Admin updated', data })
    } catch (err) {
      next(err)
    }
  },

  // DELETE /api/super/admins/:id
  delete(req, res, next) {
    try {
      superAdminManageService.delete(req.params.id)
      res.json({ success: true, message: 'Admin deleted' })
    } catch (err) {
      next(err)
    }
  },

  // PATCH /api/super/admins/:id/status
  updateStatus(req, res, next) {
    try {
      superAdminManageService.updateStatus(req.params.id, req.body.status)
      res.json({ success: true, message: `Status updated to ${req.body.status}` })
    } catch (err) {
      next(err)
    }
  },

  // PATCH /api/super/admins/:id/reset-password
  async resetPassword(req, res, next) {
    try {
      await superAdminManageService.resetPassword(req.params.id, req.body.password)
      res.json({ success: true, message: 'Password reset successfully' })
    } catch (err) {
      next(err)
    }
  },

  // POST /api/super/admins/bulk/delete
  bulkDelete(req, res, next) {
    try {
      superAdminManageService.bulkDelete(req.body.ids)
      res.json({ success: true, message: `${req.body.ids.length} admin(s) deleted` })
    } catch (err) {
      next(err)
    }
  },

  // POST /api/super/admins/bulk/status
  bulkStatus(req, res, next) {
    try {
      superAdminManageService.bulkStatus(req.body.ids, req.body.status)
      res.json({ success: true, message: `${req.body.ids.length} admin(s) updated to ${req.body.status}` })
    } catch (err) {
      next(err)
    }
  },

  // POST /api/super/admins/bulk/reset-password
  async bulkResetPassword(req, res, next) {
    try {
      await superAdminManageService.bulkResetPassword(req.body.ids, req.body.password)
      res.json({ success: true, message: `Password reset for ${req.body.ids.length} admin(s)` })
    } catch (err) {
      next(err)
    }
  },
}

module.exports = superAdminManageController
