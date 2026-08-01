const express            = require('express')
const saleController     = require('../controllers/sale_controller')
const { authenticateUser } = require('../middleware/auth')

const router = express.Router()
router.use(authenticateUser)

// GET  /api/sales/stats
router.get('/stats', saleController.stats)

// GET  /api/sales/owner
router.get('/owner', saleController.listOwnerSales)

// GET  /api/sales
router.get('/', saleController.list)

// POST /api/sales
router.post('/', saleController.create)

module.exports = router
