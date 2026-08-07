const bcrypt       = require('bcryptjs')
const { v4: uuid } = require('uuid')
const CutterModel  = require('../models/cutterModel')
const db           = require('../database/db')

function isPhoneInUse(phone, excludeId = null) {
  const user    = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone)
  if (user) return true
  const cashier = db.prepare('SELECT id FROM cashiers WHERE phone = ?').get(phone)
  if (cashier) return true
  const cutter  = excludeId
    ? db.prepare('SELECT id FROM cutters WHERE phone = ? AND id != ?').get(phone, excludeId)
    : db.prepare('SELECT id FROM cutters WHERE phone = ?').get(phone)
  if (cutter) return true
  return false
}

const cutterService = {
  getAll(ownerId) {
    return CutterModel.findAllByOwner(ownerId)
  },

  async create({ ownerId, name, phone, password }) {
    if (isPhoneInUse(phone)) {
      throw { status: 409, message: 'This phone number is already registered' }
    }
    const hash = await bcrypt.hash(password, 10)
    const id   = uuid()
    CutterModel.create({ id, ownerId, name, phone, password: hash, plainPassword: password })
    return CutterModel.findById(id)
  },

  updateStatus(id, ownerId, status) {
    const cutter = CutterModel.findById(id)
    if (!cutter || cutter.owner_id !== ownerId) {
      throw { status: 404, message: 'Cutter not found' }
    }
    CutterModel.updateStatus(id, status)
    return CutterModel.findById(id)
  },

  update(id, ownerId, { name, phone }) {
    const cutter = CutterModel.findById(id)
    if (!cutter || cutter.owner_id !== ownerId) {
      throw { status: 404, message: 'Cutter not found' }
    }
    if (phone !== cutter.phone && isPhoneInUse(phone, id)) {
      throw { status: 409, message: 'Phone number already in use' }
    }
    CutterModel.update(id, { name, phone })
    return CutterModel.findById(id)
  },

  async resetPassword(id, ownerId, password) {
    const cutter = CutterModel.findById(id)
    if (!cutter || cutter.owner_id !== ownerId) {
      throw { status: 404, message: 'Cutter not found' }
    }
    const hash = await bcrypt.hash(password, 10)
    CutterModel.updatePassword(id, hash, password)
    return CutterModel.findById(id)
  },
}

module.exports = cutterService
