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

  // POST /api/user-auth/forgot-password/check-phone
  checkPhone(req, res, next) {
    try {
      const { phone } = req.body
      if (!phone) return res.status(400).json({ success: false, message: 'Phone is required.' })
      const result = userLoginService.checkPhone(phone)
      res.json({ success: true, data: result })
    } catch (err) {
      if (err.status) return res.status(err.status).json({ success: false, message: err.message })
      next(err)
    }
  },

  // POST /api/user-auth/forgot-password/verify-otp
  async verifyOtp(req, res, next) {
    try {
      const { phone, otp, newPassword } = req.body
      if (!phone || !otp || !newPassword)
        return res.status(400).json({ success: false, message: 'phone, otp and newPassword are required.' })
      if (newPassword.length < 6)
        return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' })
      const result = await userLoginService.verifyOtp(phone, otp, newPassword)
      res.json({ success: true, data: result })
    } catch (err) {
      if (err.status) return res.status(err.status).json({ success: false, message: err.message })
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
