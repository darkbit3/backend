const express              = require('express')
const creditController     = require('../controllers/credit_controller')
const { authenticateUser } = require('../middleware/auth')

const router = express.Router()
router.use(authenticateUser)

// POST /api/credits — direct credit by owner/manufacturer/reseller
router.post('/', creditController.create)

// GET  /api/credits/owner/stats  — owner dashboard stats
router.get('/owner/stats',     creditController.ownerStats)

// GET  /api/credits/owner       — owner: all credits from all cashiers
router.get('/owner',           creditController.listOwner)

// GET  /api/credits             — cashier: own credits
router.get('/',                creditController.listMine)

// POST /api/credits/:id/payments — add a payment installment
router.post('/:id/payments',   creditController.addPayment)

module.exports = router
