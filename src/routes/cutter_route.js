const express            = require('express')
const router             = express.Router()
const cutterController   = require('../controllers/cutter_controller')
const { authenticateUser } = require('../middleware/auth')
const { validate }       = require('../middleware/validate')

router.use(authenticateUser)

// GET  /api/cutters
router.get('/', cutterController.getAll)

// POST /api/cutters
router.post('/',
  validate({
    name:     { required: true, minLength: 2 },
    phone:    { required: true, pattern: /^0[97]\d{8}$/, patternMessage: 'Phone must be 09xxxxxxxx or 07xxxxxxxx' },
    password: { required: true, minLength: 6 },
  }),
  cutterController.create
)

// PATCH /api/cutters/:id/status
router.patch('/:id/status',
  validate({ status: { required: true, enum: ['Active', 'Inactive'] } }),
  cutterController.updateStatus
)

// PUT /api/cutters/:id
router.put('/:id',
  validate({
    name:  { required: true, minLength: 2 },
    phone: { required: true, pattern: /^0[97]\d{8}$/, patternMessage: 'Phone must be 09xxxxxxxx or 07xxxxxxxx' },
  }),
  cutterController.update
)

// PATCH /api/cutters/:id/reset-password
router.patch('/:id/reset-password',
  validate({ password: { required: true, minLength: 6 } }),
  cutterController.resetPassword
)

module.exports = router
