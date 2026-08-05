const bcrypt           = require('bcryptjs')
const { v4: uuidv4 }   = require('uuid')
const AdminManageModel = require('../models/adminManageModel')

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

  getPassword(id) {
    const admin = AdminManageModel.findByIdWithPassword(id)
    if (!admin) throw { status: 404, message: 'Admin not found' }
    return admin.plain_password || '(password not available)'
  },

  async create({ name, phone, password }) {
    const existing = AdminManageModel.findByPhone(phone)
    if (existing) throw { status: 409, message: 'Phone number already registered' }

    const hash = await bcrypt.hash(password, 10)
    const id   = uuidv4()
    AdminManageModel.create({ id, name, phone, password: hash, plainPassword: password })
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
  },

  async resetPassword(id, password) {
    const admin = AdminManageModel.findById(id)
    if (!admin) throw { status: 404, message: 'Admin not found' }
    const hash = await bcrypt.hash(password, 10)
    AdminManageModel.updatePassword(id, hash, password)
  },

  bulkDelete(ids) {
    if (!Array.isArray(ids) || ids.length === 0) throw { status: 400, message: 'ids array is required' }
    AdminManageModel.bulkDelete(ids)
  },

  bulkStatus(ids, status) {
    if (!Array.isArray(ids) || ids.length === 0) throw { status: 400, message: 'ids array is required' }
    AdminManageModel.bulkUpdateStatus(ids, status)
  },

  async bulkResetPassword(ids, password) {
    if (!Array.isArray(ids) || ids.length === 0) throw { status: 400, message: 'ids array is required' }
    const hash = await bcrypt.hash(password, 10)
    AdminManageModel.bulkUpdatePassword(ids, hash, password)
  },
}

module.exports = superAdminManageService
