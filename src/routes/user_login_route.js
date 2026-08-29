const express              = require('express')
const router               = express.Router()
const userLoginController  = require('../controllers/user_login_controller')
const { authenticateUser } = require('../middleware/auth')
const { validate }         = require('../middleware/validate')

// POST /api/user-auth/login
router.post('/login',
  validate({
    phone:    { required: true, pattern: /^0[97]\d{8}$/, patternMessage: 'Phone must be 09xxxxxxxx or 07xxxxxxxx' },
    password: { required: true, minLength: 6 },
  }),
  userLoginController.login
)

// POST /api/user-auth/forgot-password/check-phone  (public)
router.post('/forgot-password/check-phone', userLoginController.checkPhone)

// POST /api/user-auth/forgot-password/verify-otp   (public)
router.post('/forgot-password/verify-otp', userLoginController.verifyOtp)

// GET /api/user-auth/me  (protected)
router.get('/me', authenticateUser, userLoginController.me)

// PUT /api/user-auth/change-password  (protected)
router.put('/change-password',
  authenticateUser,
  validate({
    currentPassword: { required: true },
    newPassword:     { required: true, minLength: 6 },
  }),
  userLoginController.changePassword
)

// PUT /api/user-auth/alert-threshold  (protected)
router.put('/alert-threshold',
  authenticateUser,
  validate({
    threshold: { required: true, min: 5, max: 100 },
  }),
  userLoginController.updateAlertThreshold
)

module.exports = router
