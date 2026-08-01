const bcrypt         = require('bcryptjs')
const { v4: uuidv4 } = require('uuid')
const UserModel      = require('../models/userModel')
const db             = require('../database/db')

function isPhoneInUse(phone, excludeId = null) {
  const user = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone)
  if (user && user.id !== excludeId) return true

  const cashier = db.prepare('SELECT id FROM cashiers WHERE phone = ?').get(phone)
  if (cashier && cashier.id !== excludeId) return true

  const cutter = db.prepare('SELECT id FROM cutters WHERE phone = ?').get(phone)
  if (cutter && cutter.id !== excludeId) return true

  return false
}

const adminManageService = {
  getAll() {
    return UserModel.findAll()
  },

  getStats() {
    return UserModel.getStats()
  },

  getOne(id) {
    const user = UserModel.findById(id)
    if (!user) throw { status: 404, message: 'User not found' }
    return user
  },

  getPassword(id) {
    const user = UserModel.findByIdWithPassword(id)
    if (!user) throw { status: 404, message: 'User not found' }
    return user.plain_password || '(password not available)'
  },

  async create({ name, phone, password, role, accountType, freeUntil }) {
    if (isPhoneInUse(phone)) {
      throw { status: 409, message: 'Phone number already registered across accounts' }
    }

    const hash = await bcrypt.hash(password, 10)
    const id   = uuidv4()
    UserModel.create({ id, name, phone, password: hash, plainPassword: password, role, accountType, freeUntil })
    return UserModel.findById(id)
  },

  update(id, { name, phone, role, accountType, freeUntil }) {
    const user = UserModel.findById(id)
    if (!user) throw { status: 404, message: 'User not found' }

    if (isPhoneInUse(phone, id)) {
      throw { status: 409, message: 'Phone number already in use' }
    }

    UserModel.update(id, { name, phone, role, accountType, freeUntil })
    return UserModel.findById(id)
  },

  delete(id) {
    const user = UserModel.findById(id)
    if (!user) throw { status: 404, message: 'User not found' }
    UserModel.delete(id)
  },

  updateStatus(id, status) {
    const user = UserModel.findById(id)
    if (!user) throw { status: 404, message: 'User not found' }
    UserModel.updateStatus(id, status)
  },

  async resetPassword(id, password) {
    const user = UserModel.findById(id)
    if (!user) throw { status: 404, message: 'User not found' }
    const hash = await bcrypt.hash(password, 10)
    UserModel.updatePassword(id, hash, password)
  },

  bulkDelete(ids) {
    if (!Array.isArray(ids) || ids.length === 0) throw { status: 400, message: 'ids array is required' }
    UserModel.bulkDelete(ids)
  },

  bulkStatus(ids, status) {
    if (!Array.isArray(ids) || ids.length === 0) throw { status: 400, message: 'ids array is required' }
    UserModel.bulkUpdateStatus(ids, status)
  },

  async bulkResetPassword(ids, password) {
    if (!Array.isArray(ids) || ids.length === 0) throw { status: 400, message: 'ids array is required' }
    const hash = await bcrypt.hash(password, 10)
    UserModel.bulkUpdatePassword(ids, hash, password)
  },
}

module.exports = adminManageService
