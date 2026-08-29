const express              = require('express')
const materialController   = require('../controllers/material_controller')
const { authenticateUser } = require('../middleware/auth')

const router = express.Router()
router.use(authenticateUser)

router.post('/',              materialController.create)
router.get('/',              materialController.list)
router.get('/owner-stock',   materialController.listOwnerStock)
router.get('/low-stock',     materialController.listLowStock)
router.put('/:id',           materialController.update)
router.delete('/:id',        materialController.remove)

module.exports = router
