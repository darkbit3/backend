const bcrypt           = require('bcryptjs')
const { v4: uuidv4 }   = require('uuid')
const AdminManageModel = require('../models/adminManageModel')
const db               = require('../database/db')

const superAdminManageService = {
  getAll() {
    return AdminManageModel.findAll()
  },

  getStats() {
    return AdminManageModel.getStats()
  },

  getOne(id) {
    const admin = AdminManageModel.findById(id)
    if (!admin) throw { status: 404, message: 'Admin not found' }
    return admin
  },

  async create({ name, phone, password }) {
    const existing = AdminManageModel.findByPhone(phone)
    if (existing) throw { status: 409, message: 'Phone number already registered' }

    const hash = await bcrypt.hash(password, 10)
    const id   = uuidv4()
    AdminManageModel.create({ id, name, phone, password: hash })
    return AdminManageModel.findById(id)
  },

  update(id, { name, phone }) {
    const admin = AdminManageModel.findById(id)
    if (!admin) throw { status: 404, message: 'Admin not found' }

    const existing = AdminManageModel.findByPhone(phone)
    if (existing && existing.id !== id) {
      throw { status: 409, message: 'Phone number already in use' }
    }

    AdminManageModel.update(id, { name, phone })
    return AdminManageModel.findById(id)
  },

  delete(id) {
    const admin = AdminManageModel.findById(id)
    if (!admin) throw { status: 404, message: 'Admin not found' }
    AdminManageModel.delete(id)
  },

  updateStatus(id, status) {
    const admin = AdminManageModel.findById(id)
    if (!admin) throw { status: 404, message: 'Admin not found' }
    AdminManageModel.updateStatus(id, status)
    if (status === 'Inactive') {
      db.prepare('DELETE FROM refresh_tokens WHERE admin_id = ?').run(id)
    }
  },

  async resetPassword(id, password) {
    const admin = AdminManageModel.findById(id)
    if (!admin) throw { status: 404, message: 'Admin not found' }
    const hash = await bcrypt.hash(password, 10)
    AdminManageModel.updatePassword(id, hash)
  },

  bulkDelete(ids) {
    if (!Array.isArray(ids) || ids.length === 0) throw { status: 400, message: 'ids array is required' }
    const result = AdminManageModel.bulkDelete(ids)
    if (result.deleted !== ids.length) throw { status: 404, message: `${ids.length - result.deleted} admin(s) not found` }
  },

  bulkStatus(ids, status) {
    if (!Array.isArray(ids) || ids.length === 0) throw { status: 400, message: 'ids array is required' }
    const result = AdminManageModel.bulkUpdateStatus(ids, status)
    if (result.updated !== ids.length) throw { status: 404, message: `${ids.length - result.updated} admin(s) not found` }
  },

  async bulkResetPassword(ids, password) {
    if (!Array.isArray(ids) || ids.length === 0) throw { status: 400, message: 'ids array is required' }
    const hash = await bcrypt.hash(password, 10)
    const result = AdminManageModel.bulkUpdatePassword(ids, hash)
    if (result.updated !== ids.length) throw { status: 404, message: `${ids.length - result.updated} admin(s) not found` }
  },
}

module.exports = superAdminManageService
