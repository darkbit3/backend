const userLoginService = require('../services/user_login_service')

const userLoginController = {
  // POST /api/user-auth/login
  async login(req, res, next) {
    try {
      const { phone, password } = req.body
      const data = await userLoginService.login(phone, password)
      res.json({ success: true, message: 'Login successful', data })
    } catch (err) {
      next(err)
    }
  },

  // GET /api/user-auth/me  (requires authenticateUser)
  me(req, res, next) {
    try {
      const data = userLoginService.getMe(req.user.id)
      res.json({ success: true, data })
    } catch (err) {
      next(err)
    }
  },

  // PUT /api/user-auth/change-password
  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body
      await userLoginService.changePassword(
        req.user.id,
        currentPassword,
        newPassword
      )
      res.json({ success: true, message: 'Password changed successfully' })
    } catch (err) {
      next(err)
    }
  },

  // PUT /api/user-auth/alert-threshold
  updateAlertThreshold(req, res, next) {
    try {
      const { threshold } = req.body
      userLoginService.updateAlertThreshold(req.user.id, threshold)
      res.json({ success: true, message: 'Alert threshold updated successfully' })
    } catch (err) {
      next(err)
    }
  },
}

module.exports = userLoginController
