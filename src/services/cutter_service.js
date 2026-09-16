const bcrypt       = require('bcryptjs')
const { v4: uuid } = require('uuid')
const CutterModel  = require('../models/cutterModel')
const db           = require('../database/db')
const { normalizePhone } = require('../utils/phone')

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
    const normalizedPhone = normalizePhone(phone)
    if (!normalizedPhone) throw { status: 400, message: 'Phone must be 09/07, 251, or +251 followed by 9 digits' }
    if (isPhoneInUse(normalizedPhone)) {
      throw { status: 409, message: 'This phone number is already registered' }
    }
    const hash = await bcrypt.hash(password, 10)
    const id   = uuid()
    CutterModel.create({ id, ownerId, name, phone: normalizedPhone, password: hash })
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
    const normalizedPhone = normalizePhone(phone)
    if (!normalizedPhone) throw { status: 400, message: 'Phone must be 09/07, 251, or +251 followed by 9 digits' }
    if (normalizedPhone !== cutter.phone && isPhoneInUse(normalizedPhone, id)) {
      throw { status: 409, message: 'Phone number already in use' }
    }
    CutterModel.update(id, { name, phone: normalizedPhone })
    return CutterModel.findById(id)
  },

  async resetPassword(id, ownerId, password) {
    const cutter = CutterModel.findById(id)
    if (!cutter || cutter.owner_id !== ownerId) {
      throw { status: 404, message: 'Cutter not found' }
    }
    const hash = await bcrypt.hash(password, 10)
    CutterModel.updatePassword(id, hash)
    return CutterModel.findById(id)
  },
}

module.exports = cutterService
