const express = require('express')
const router = express.Router()
const controller = require('../controllers/material_order_controller')
const { authenticateUser } = require('../middleware/auth')

router.use(authenticateUser)
router.post('/', controller.create)
router.get('/mine', controller.listMine)
router.get('/owner', controller.listOwner)
router.patch('/:id/status', controller.updateStatus)

module.exports = router
