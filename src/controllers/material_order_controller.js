const materialOrderService = require('../services/material_order_service')

const materialOrderController = {
  create(req, res, next) {
    try {
      if (!req.user.owner_id) {
        return res.status(403).json({ success: false, message: 'Only cashiers can request materials.' })
      }
      const ownerId = req.user.owner_id || req.user.id
      const data = materialOrderService.create(req.user.id, ownerId, req.body)
      res.status(201).json({ success: true, message: 'Material order requested', data })
    } catch (err) {
      if (err.status) return res.status(err.status).json({ success: false, message: err.message })
      next(err)
    }
  },
  listMine(req, res, next) {
    try { res.json({ success: true, data: materialOrderService.listForRequester(req.user.id) }) } catch (err) { next(err) }
  },
  listOwner(req, res, next) {
    try {
      const ownerId = req.user.owner_id || req.user.id
      res.json({ success: true, data: materialOrderService.listForOwner(ownerId) })
    } catch (err) { next(err) }
  },
  updateStatus(req, res, next) {
    try {
      if (req.user.owner_id) {
        return res.status(403).json({ success: false, message: 'Only the owner can update order status.' })
      }
      const ownerId = req.user.owner_id || req.user.id
      const data = materialOrderService.updateStatus(req.params.id, ownerId, req.body.status)
      res.json({ success: true, data })
    } catch (err) {
      if (err.status) return res.status(err.status).json({ success: false, message: err.message })
      next(err)
    }
  },
}

module.exports = materialOrderController
