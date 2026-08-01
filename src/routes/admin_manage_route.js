const express                = require('express')
const router                 = express.Router()
const adminManageController  = require('../controllers/admin_manage_controller')
const { authenticate }       = require('../middleware/auth')
const { validate }           = require('../middleware/validate')

// All manage routes are protected
router.use(authenticate)

// Bulk operations (must be before /:id routes)
router.post('/bulk/delete',         adminManageController.bulkDelete)
router.post('/bulk/status',         adminManageController.bulkStatus)
router.post('/bulk/reset-password', adminManageController.bulkResetPassword)

// CRUD
router.get('/',         adminManageController.getAll)
router.get('/stats',    adminManageController.getStats)
router.get('/:id',          adminManageController.getOne)
router.get('/:id/password', adminManageController.getPassword)

router.post('/',
  validate({
    name:        { required: true, minLength: 2 },
    phone:       { required: true, pattern: /^0[97]\d{8}$/, patternMessage: 'Phone must be 09xxxxxxxx or 07xxxxxxxx' },
    password:    { required: true, minLength: 6 },
    role:        { required: true, enum: ['Manufacturer', 'Reseller'] },
    accountType: { required: false, enum: ['Free', 'Paid'] },
  }),
  adminManageController.create
)

router.put('/:id',
  validate({
    name:        { required: true, minLength: 2 },
    phone:       { required: true, pattern: /^0[97]\d{8}$/, patternMessage: 'Phone must be 09xxxxxxxx or 07xxxxxxxx' },
    role:        { required: true, enum: ['Manufacturer', 'Reseller'] },
    accountType: { required: false, enum: ['Free', 'Paid'] },
  }),
  adminManageController.update
)

router.delete('/:id', adminManageController.delete)

router.patch('/:id/status',
  validate({ status: { required: true, enum: ['Active', 'Inactive'] } }),
  adminManageController.updateStatus
)

router.patch('/:id/reset-password',
  validate({ password: { required: true, minLength: 6 } }),
  adminManageController.resetPassword
)

module.exports = router
