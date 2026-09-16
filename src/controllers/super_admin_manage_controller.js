const superAdminManageService = require('../services/super_admin_manage_service')
const paymentInfoService      = require('../services/payment_info_service')

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

  getRegisterFee(req, res, next) {
    try {
      const plans = superAdminManageService.getRegisterFee()
      const data = plans
      res.json({ success: true, data, message: 'Register fee fetched successfully' })
    } catch (err) {
      next(err)
    }
  },

  setRegisterFee(req, res, next) {
    try {
      const plans = superAdminManageService.setRegisterFee(req.body)
      res.json({ success: true, data: plans, message: 'Register fee updated successfully' })
    } catch (err) {
      next(err)
    }
  },

  getActiveRegisterPlans(req, res, next) {
    try {
      res.json({ success: true, data: superAdminManageService.getActiveRegisterPlans() })
    } catch (err) {
      next(err)
    }
  },

  // GET /api/super/admins/settings/payment-info
  getPaymentInfo(req, res, next) {
    try {
      res.json({ success: true, data: paymentInfoService.getPaymentInfo() })
    } catch (err) {
      next(err)
    }
  },

  // PUT /api/super/admins/settings/payment-info
  updatePaymentInfo(req, res, next) {
    try {
      const data = paymentInfoService.updatePaymentInfo(req.body)
      res.json({ success: true, message: 'Payment info updated', data })
    } catch (err) {
      next(err)
    }
  },

  // GET /api/super/admins/registration-requests
  getRegistrationRequests(req, res, next) {
    try {
      const { status } = req.query
      const data = paymentInfoService.getRegistrationRequests(status)
      res.json({ success: true, data })
    } catch (err) {
      next(err)
    }
  },

  // GET /api/super/admins/registration-requests/stats
  getRegistrationStats(req, res, next) {
    try {
      const data = paymentInfoService.getStats()
      res.json({ success: true, data })
    } catch (err) {
      next(err)
    }
  },

  // POST /api/super/admins/registration-requests/:id/approve
  approveRegistration(req, res, next) {
    try {
      const data = paymentInfoService.approveRegistration(req.params.id)
      res.json({ success: true, message: 'Registration approved', data })
    } catch (err) {
      next(err)
    }
  },

  // POST /api/super/admins/registration-requests/:id/reject
  rejectRegistration(req, res, next) {
    try {
      const data = paymentInfoService.rejectRegistration(req.params.id, req.body.reason)
      res.json({ success: true, message: 'Registration rejected', data })
    } catch (err) {
      next(err)
    }
  },
}

module.exports = superAdminManageController
