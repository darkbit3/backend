const express                    = require('express')
const router                     = express.Router()
const superAdminManageController = require('../controllers/super_admin_manage_controller')
const { authenticateSuperAdmin } = require('../middleware/superAdminAuth')
const { validate }               = require('../middleware/validate')

// All routes are super-admin protected
router.use(authenticateSuperAdmin)

// Bulk operations (must be before /:id routes)
router.post('/bulk/delete',         superAdminManageController.bulkDelete)
router.post('/bulk/status',         superAdminManageController.bulkStatus)
router.post('/bulk/reset-password', superAdminManageController.bulkResetPassword)

// Stats
router.get('/stats', superAdminManageController.getStats)

// CRUD
router.get('/',             superAdminManageController.getAll)
router.get('/:id',          superAdminManageController.getOne)
router.get('/:id/password', superAdminManageController.getPassword)

router.post('/',
  validate({
    name:     { required: true, minLength: 2 },
    phone:    { required: true, pattern: /^0[97]\d{8}$/, patternMessage: 'Phone must be 09xxxxxxxx or 07xxxxxxxx' },
    password: { required: true, minLength: 6 },
  }),
  superAdminManageController.create
)

router.put('/:id',
  validate({
    name:  { required: true, minLength: 2 },
    phone: { required: true, pattern: /^0[97]\d{8}$/, patternMessage: 'Phone must be 09xxxxxxxx or 07xxxxxxxx' },
  }),
  superAdminManageController.update
)

router.delete('/:id', superAdminManageController.delete)

router.patch('/:id/status',
  validate({ status: { required: true, enum: ['Active', 'Inactive'] } }),
  superAdminManageController.updateStatus
)

router.patch('/:id/reset-password',
  validate({ password: { required: true, minLength: 6 } }),
  superAdminManageController.resetPassword
)

module.exports = router
