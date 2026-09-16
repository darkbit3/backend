const bcrypt           = require('bcryptjs')
const { v4: uuidv4 }   = require('uuid')
const AdminManageModel = require('../models/adminManageModel')
const db               = require('../database/db')

const DEFAULT_REGISTER_FEES = {
  oneMonth: { months: 1, label: 'Free for 1 month', fee: 0, enabled: true },
  twoMonths: { months: 2, label: 'Free for 2 months', fee: 0, enabled: true },
  threeMonths: { months: 3, label: 'Free for 3 months', fee: 0, enabled: true },
  sixMonths: { months: 6, label: 'Free for 6 months', fee: 0, enabled: true },
  oneYear: { months: 12, label: 'Free for 1 year', fee: 0, enabled: true },
}

function getSettingValue(key, fallback = null) {
  const row = db.prepare('SELECT setting_value FROM system_settings WHERE setting_key = ?').get(key)
  if (!row) return fallback
  return row.setting_value
}

function upsertSetting(key, value, description = '') {
  const existing = db.prepare('SELECT id FROM system_settings WHERE setting_key = ?').get(key)
  const now = new Date().toISOString()
  if (existing) {
    db.prepare(
      'UPDATE system_settings SET setting_value = ?, description = COALESCE(?, description), updated_at = ? WHERE id = ?'
    ).run(String(value), description || null, now, existing.id)
    return
  }

  db.prepare(
    'INSERT INTO system_settings (id, setting_key, setting_value, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(uuidv4(), key, String(value), description || null, now, now)
}

function normalizeRegisterPlans(rawPlans) {
  const plans = {}
  for (const [key, defaults] of Object.entries(DEFAULT_REGISTER_FEES)) {
    const source = rawPlans?.[key] || {}
    const fee = Number(source.fee ?? source)
    plans[key] = {
      ...defaults,
      fee: Number.isFinite(fee) && fee >= 0 ? Number(fee.toFixed(2)) : defaults.fee,
      enabled: source.enabled === undefined ? defaults.enabled : Boolean(source.enabled),
    }
  }
  return plans
}

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

  getRegisterFee() {
    const raw = getSettingValue('register_fee_plans')
    if (raw) {
      try {
        return normalizeRegisterPlans(JSON.parse(raw))
      } catch (_) {}
    }

    const legacyFee = Number(getSettingValue('register_fee', '0'))
    const plans = normalizeRegisterPlans()
    plans.oneMonth.fee = Number.isFinite(legacyFee) ? legacyFee : 0
    return plans
  },

  setRegisterFee(plans) {
    const normalized = {}
    for (const [key, defaults] of Object.entries(DEFAULT_REGISTER_FEES)) {
      const plan = plans?.[key] || {}
      const numericFee = Number(plan.fee)
      if (!Number.isFinite(numericFee) || numericFee < 0) {
        throw { status: 400, message: 'Each register fee must be a valid non-negative number' }
      }
      normalized[key] = {
        ...defaults,
        fee: Number(numericFee.toFixed(2)),
        enabled: plan.enabled === true,
      }
    }

    upsertSetting('register_fee_plans', JSON.stringify(normalized), 'Registration fees and availability for all registration plans')
    return this.getRegisterFee()
  },

  getActiveRegisterPlans() {
    return Object.entries(this.getRegisterFee())
      .filter(([, plan]) => plan.enabled)
      .map(([key, plan]) => ({ key, ...plan }))
  },

  getRegisterPlan(key) {
    const plan = this.getRegisterFee()[key]
    if (!plan || !plan.enabled) throw { status: 400, message: 'Selected registration plan is unavailable' }
    return { key, ...plan }
  },
}

module.exports = superAdminManageService
