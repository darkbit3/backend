const superAdminLoginService = require('../services/super_admin_login_service')

const superAdminLoginController = {
  // POST /api/super-auth/login
  async login(req, res, next) {
    try {
      const { phone, password } = req.body
      const data = await superAdminLoginService.login(phone, password)
      res.json({ success: true, message: 'Login successful', data })
    } catch (err) {
      next(err)
    }
  },

  // POST /api/super-auth/refresh
  async refresh(req, res, next) {
    try {
      const { refreshToken } = req.body
      const data = await superAdminLoginService.refresh(refreshToken)
      res.json({ success: true, data })
    } catch (err) {
      next(err)
    }
  },

  // POST /api/super-auth/logout
  logout(req, res, next) {
    try {
      superAdminLoginService.logout(req.body.refreshToken)
      res.json({ success: true, message: 'Logged out successfully' })
    } catch (err) {
      next(err)
    }
  },

  // GET /api/super-auth/me
  me(req, res, next) {
    try {
      const data = superAdminLoginService.getMe(req.superAdmin.id)
      res.json({ success: true, data })
    } catch (err) {
      next(err)
    }
  },

  // PUT /api/super-auth/change-password
  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body
      await superAdminLoginService.changePassword(req.superAdmin.phone, currentPassword, newPassword)
      res.json({ success: true, message: 'Password changed successfully' })
    } catch (err) {
      next(err)
    }
  },
}

module.exports = superAdminLoginController
