const materialService = require('../services/material_service')

const materialController = {
  create(req, res, next) {
    try {
      const userId = req.user.id
      const material = materialService.create(userId, req.body)
      res.status(201).json({ success: true, data: material })
    } catch (err) {
      if (err.status) return res.status(err.status).json({ success: false, message: err.message })
      next(err)
    }
  },

  list(req, res, next) {
    try {
      const ownerId = req.user.owner_id || req.user.id
      const materials = materialService.listForOwner(ownerId)
      res.json({ success: true, data: materials })
    } catch (err) {
      next(err)
    }
  },

  // GET /api/materials/owner-stock
  // Cashier calls this to see their owner's available stock
  listOwnerStock(req, res, next) {
    try {
      // owner_id is embedded in the JWT for cashiers
      const ownerId = req.user.owner_id || req.user.id
      const materials = materialService.listForOwner(ownerId)
      res.json({ success: true, data: materials })
    } catch (err) {
      next(err)
    }
  },

  // GET /api/materials/low-stock
  listLowStock(req, res, next) {
    try {
      const MaterialModel = require('../models/materialModel')
      const ownerId = req.user.owner_id || req.user.id
      const lowStock = MaterialModel.findLowStock(ownerId)
      res.json({ success: true, data: lowStock })
    } catch (err) {
      next(err)
    }
  },

  remove(req, res, next) {
    try {
      const userId = req.user.id
      const { id } = req.params
      const result = materialService.delete(id, userId)
      res.json({ success: true, data: result })
    } catch (err) {
      if (err.status) return res.status(err.status).json({ success: false, message: err.message })
      next(err)
    }
  },
}

module.exports = materialController
