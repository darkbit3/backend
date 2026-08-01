const express               = require('express')
const router                = express.Router()
const adminLoginController  = require('../controllers/admin_login_controller')
const { authenticate }      = require('../middleware/auth')
const { validate }          = require('../middleware/validate')

// POST /api/auth/login
router.post('/login',
  validate({
    phone:    { required: true, pattern: /^0[97]\d{8}$/, patternMessage: 'Phone must be 09xxxxxxxx or 07xxxxxxxx' },
    password: { required: true, minLength: 6 },
  }),
  adminLoginController.login
)

// POST /api/auth/refresh
router.post('/refresh', adminLoginController.refresh)

// POST /api/auth/logout
router.post('/logout', adminLoginController.logout)

// GET /api/auth/me  (protected)
router.get('/me', authenticate, adminLoginController.me)

// PUT /api/auth/change-password  (protected)
router.put('/change-password',
  authenticate,
  validate({
    currentPassword: { required: true },
    newPassword:     { required: true, minLength: 6 },
  }),
  adminLoginController.changePassword
)

module.exports = router
