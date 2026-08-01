const adminLoginService = require('../services/admin_login_service')

const adminLoginController = {
  // POST /api/auth/login
  async login(req, res, next) {
    try {
      const { phone, password } = req.body
      const data = await adminLoginService.login(phone, password)
      res.json({ success: true, message: 'Login successful', data })
    } catch (err) {
      next(err)
    }
  },

  // POST /api/auth/refresh
  async refresh(req, res, next) {
    try {
      const { refreshToken } = req.body
      const data = await adminLoginService.refresh(refreshToken)
      res.json({ success: true, data })
    } catch (err) {
      next(err)
    }
  },

  // POST /api/auth/logout
  logout(req, res, next) {
    try {
      adminLoginService.logout(req.body.refreshToken)
      res.json({ success: true, message: 'Logged out successfully' })
    } catch (err) {
      next(err)
    }
  },

  // GET /api/auth/me
  me(req, res, next) {
    try {
      const data = adminLoginService.getMe(req.admin.id)
      res.json({ success: true, data })
    } catch (err) {
      next(err)
    }
  },

  // PUT /api/auth/change-password
  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body
      await adminLoginService.changePassword(req.admin.phone, currentPassword, newPassword)
      res.json({ success: true, message: 'Password changed successfully' })
    } catch (err) {
      next(err)
    }
  },
}

module.exports = adminLoginController
