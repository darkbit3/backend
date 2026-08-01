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

module.exports = router
