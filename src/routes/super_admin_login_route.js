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
