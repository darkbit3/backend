const bcrypt         = require('bcryptjs')
const { v4: uuidv4 } = require('uuid')
const CashierModel   = require('../models/cashierModel')
const db             = require('../database/db')

function isPhoneInUse(phone) {
  const user = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone)
  if (user) return true
  const cashier = db.prepare('SELECT id FROM cashiers WHERE phone = ?').get(phone)
  if (cashier) return true
  const cutter = db.prepare('SELECT id FROM cutters WHERE phone = ?').get(phone)
  if (cutter) return true
  return false
}

const cashierService = {
  /** Return all cashiers owned by this user. */
  getAll(ownerId) {
    return CashierModel.findAllByOwner(ownerId)
  },

  /** Create a new cashier under the given owner. */
  async create({ ownerId, name, phone, password }) {
    if (isPhoneInUse(phone)) {
      throw { status: 409, message: 'This phone number is already registered' }
    }

    const hash = await bcrypt.hash(password, 10)
    const id   = uuidv4()
    CashierModel.create({ id, ownerId, name, phone, password: hash })
    return CashierModel.findById(id)
  },

  updateStatus(id, ownerId, status) {
    const cashier = CashierModel.findById(id)
    if (!cashier || cashier.owner_id !== ownerId) {
      throw { status: 404, message: 'Cashier not found' }
    }
    CashierModel.updateStatus(id, status)
    return CashierModel.findById(id)
  },

  update(id, ownerId, { name, phone }) {
    const cashier = CashierModel.findById(id)
    if (!cashier || cashier.owner_id !== ownerId) {
      throw { status: 404, message: 'Cashier not found' }
    }
    // Check phone uniqueness across all tables (excluding self)
    if (phone !== cashier.phone) {
      const inUse = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone) ||
                    db.prepare('SELECT id FROM cashiers WHERE phone = ? AND id != ?').get(phone, id) ||
                    db.prepare('SELECT id FROM cutters WHERE phone = ?').get(phone)
      if (inUse) throw { status: 409, message: 'Phone number already in use' }
    }
    CashierModel.update(id, { name, phone })
    return CashierModel.findById(id)
  },

  async resetPassword(id, ownerId, password) {
    const cashier = CashierModel.findById(id)
    if (!cashier || cashier.owner_id !== ownerId) {
      throw { status: 404, message: 'Cashier not found' }
    }
    const hash = await bcrypt.hash(password, 10)
    CashierModel.updatePassword(id, hash)
    return CashierModel.findById(id)
  },
}

module.exports = cashierService

