const express            = require('express')
const router             = express.Router()
const cashierController  = require('../controllers/cashier_controller')
const { authenticateUser } = require('../middleware/auth')
const { validate }       = require('../middleware/validate')

// All cashier routes require a logged-in user (Manufacturer / Reseller)
router.use(authenticateUser)

// GET  /api/cashiers
router.get('/', cashierController.getAll)

// POST /api/cashiers
router.post(
  '/',
  validate({
    name:     { required: true, minLength: 2 },
    phone:    {
      required:       true,
      pattern:        /^0[97]\d{8}$/,
      patternMessage: 'Phone must be 09xxxxxxxx or 07xxxxxxxx',
    },
    password: { required: true, minLength: 6 },
  }),
  cashierController.create
)

// PATCH /api/cashiers/:id/status
router.patch(
  '/:id/status',
  validate({
    status: { required: true, enum: ['Active', 'Inactive'] },
  }),
  cashierController.updateStatus
)

// PUT /api/cashiers/:id
router.put(
  '/:id',
  validate({
    name:  { required: true, minLength: 2 },
    phone: { required: true, pattern: /^0[97]\d{8}$/, patternMessage: 'Phone must be 09xxxxxxxx or 07xxxxxxxx' },
  }),
  cashierController.update
)

// PATCH /api/cashiers/:id/reset-password
router.patch(
  '/:id/reset-password',
  validate({ password: { required: true, minLength: 6 } }),
  cashierController.resetPassword
)

module.exports = router

