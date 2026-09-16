const express                    = require('express')
const router                     = express.Router()
const superAdminLoginController  = require('../controllers/super_admin_login_controller')
const { authenticateSuperAdmin } = require('../middleware/superAdminAuth')
const { validate }               = require('../middleware/validate')

// POST /api/super-auth/login
router.post('/login',
  validate({
    phone:    { required: true, minLength: 1 },
    password: { required: true, minLength: 4 },
  }),
  superAdminLoginController.login
)

// POST /api/super-auth/refresh
router.post('/refresh', superAdminLoginController.refresh)

// POST /api/super-auth/logout
router.post('/logout', superAdminLoginController.logout)

// POST /api/super-auth/forgot-password/check-email
router.post('/forgot-password/check-email',
  validate({ email: { required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, patternMessage: 'Enter a valid email address' } }),
  superAdminLoginController.checkEmail
)

// POST /api/super-auth/forgot-password/verify-otp
router.post('/forgot-password/verify-otp',
  validate({
    email: { required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, patternMessage: 'Enter a valid email address' },
    otp: { required: true, pattern: /^\d{6}$/, patternMessage: 'OTP must be 6 digits' },
    newPassword: { required: true, minLength: 6 },
  }),
  superAdminLoginController.verifyEmailOtp
)

// GET /api/super-auth/me  (protected)
router.get('/me', authenticateSuperAdmin, superAdminLoginController.me)

// PUT /api/super-auth/change-password  (protected)
router.put('/change-password',
  authenticateSuperAdmin,
  validate({
    currentPassword: { required: true },
    newPassword:     { required: true, minLength: 6 },
  }),
  superAdminLoginController.changePassword
)

module.exports = router
