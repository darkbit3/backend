const db = require('../database/db')
const { v4: uuidv4 } = require('uuid')
const { getPhoneVariants } = require('../utils/phone')

const DEFAULT_ACCOUNTS = [
  {
    id: '1',
    bank: 'Commercial Bank of Ethiopia (CBE)',
    accountName: 'Shmeta Business PLC',
    accountNumber: '1000234567890',
  },
  {
    id: '2',
    bank: 'Telebirr',
    accountName: 'Shmeta Business PLC',
    accountNumber: '0911002233',
  },
]

function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT setting_value FROM system_settings WHERE setting_key = ?').get(key)
  return row ? row.setting_value : fallback
}

function upsertSetting(key, value, description = '') {
  const existing = db.prepare('SELECT id FROM system_settings WHERE setting_key = ?').get(key)
  const now = new Date().toISOString()
  if (existing) {
    db.prepare(
      'UPDATE system_settings SET setting_value = ?, description = COALESCE(?, description), updated_at = ? WHERE id = ?'
    ).run(String(value), description || null, now, existing.id)
  } else {
    db.prepare(
      'INSERT INTO system_settings (id, setting_key, setting_value, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(uuidv4(), key, String(value), description || null, now, now)
  }
}

const paymentInfoService = {
  getPaymentInfo() {
    const rawTelegram = getSetting('payment_telegram_username', '@shmeta_admin')
    const rawAccounts = getSetting('payment_accounts')

    let accounts = DEFAULT_ACCOUNTS
    if (rawAccounts) {
      try {
        const parsed = JSON.parse(rawAccounts)
        if (Array.isArray(parsed) && parsed.length > 0) {
          accounts = parsed
        }
      } catch (_) {}
    }

    return {
      telegramUsername: rawTelegram.startsWith('@') ? rawTelegram : `@${rawTelegram}`,
      accounts,
    }
  },

  updatePaymentInfo({ telegramUsername, accounts }) {
    if (!telegramUsername || typeof telegramUsername !== 'string') {
      throw { status: 400, message: 'Telegram username is required' }
    }
    const cleanTelegram = telegramUsername.trim().replace(/^@+/, '')
    if (!cleanTelegram) {
      throw { status: 400, message: 'Invalid Telegram username' }
    }

    if (!Array.isArray(accounts)) {
      throw { status: 400, message: 'Accounts list must be an array' }
    }

    const validatedAccounts = accounts.map((acc, index) => {
      const bank = String(acc.bank || '').trim()
      const accountName = String(acc.accountName || '').trim()
      const accountNumber = String(acc.accountNumber || '').trim()

      if (!bank || !accountName || !accountNumber) {
        throw { status: 400, message: `Account item #${index + 1} has missing fields` }
      }

      return {
        id: acc.id || String(index + 1),
        bank,
        accountName,
        accountNumber,
      }
    })

    upsertSetting('payment_telegram_username', `@${cleanTelegram}`, 'Telegram username for receiving payment receipts')
    upsertSetting('payment_accounts', JSON.stringify(validatedAccounts), 'Bank accounts list for subscription payments')

    return this.getPaymentInfo()
  },

  createRegistrationRequest({ userId, name, phone, role, planKey, planLabel, fee }) {
    const id = uuidv4()
    const now = new Date().toISOString()
    db.prepare(`
      INSERT INTO registration_requests (
        id, user_id, name, phone, role, plan_key, plan_label, fee, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?)
    `).run(id, userId, name, phone, role, planKey, planLabel, Number(fee) || 0, now, now)

    return db.prepare('SELECT * FROM registration_requests WHERE id = ?').get(id)
  },

  getRegistrationRequests(status = null) {
    let sql = 'SELECT * FROM registration_requests'
    const params = []
    if (status && status !== 'all') {
      sql += ' WHERE LOWER(status) = LOWER(?)'
      params.push(status)
    }
    sql += ' ORDER BY created_at DESC'
    return db.prepare(sql).all(...params)
  },

  getStats() {
    const total = db.prepare('SELECT COUNT(*) as count FROM registration_requests').get().count
    const pending = db.prepare("SELECT COUNT(*) as count FROM registration_requests WHERE status = 'Pending'").get().count
    const approved = db.prepare("SELECT COUNT(*) as count FROM registration_requests WHERE status = 'Approved'").get().count
    const rejected = db.prepare("SELECT COUNT(*) as count FROM registration_requests WHERE status = 'Rejected'").get().count
    const totalFees = db.prepare("SELECT COALESCE(SUM(fee), 0) as total FROM registration_requests WHERE status = 'Approved'").get().total

    return { total, pending, approved, rejected, totalFees: Number(totalFees) || 0 }
  },

  approveRegistration(id) {
    const request = db.prepare('SELECT * FROM registration_requests WHERE id = ?').get(id)
    if (!request) throw { status: 404, message: 'Registration request not found' }

    const now = new Date().toISOString()
    db.prepare("UPDATE registration_requests SET status = 'Approved', updated_at = ? WHERE id = ?").run(now, id)
    // Activate the corresponding user
    db.prepare("UPDATE users SET status = 'Active', updated_at = ? WHERE id = ?").run(now, request.user_id)

    return db.prepare('SELECT * FROM registration_requests WHERE id = ?').get(id)
  },

  rejectRegistration(id, reason = null) {
    const request = db.prepare('SELECT * FROM registration_requests WHERE id = ?').get(id)
    if (!request) throw { status: 404, message: 'Registration request not found' }

    const now = new Date().toISOString()
    db.prepare("UPDATE registration_requests SET status = 'Rejected', rejection_reason = ?, updated_at = ? WHERE id = ?").run(
      reason || 'Payment verification could not be confirmed',
      now,
      id
    )
    db.prepare("UPDATE users SET status = 'Inactive', updated_at = ? WHERE id = ?").run(now, request.user_id)

    return db.prepare('SELECT * FROM registration_requests WHERE id = ?').get(id)
  },

  getLatestRegistrationRequestByPhone(phone) {
    const variants = getPhoneVariants(phone)
    const placeholders = variants.map(() => '?').join(', ')
    return db.prepare(`
      SELECT * FROM registration_requests 
      WHERE phone IN (${placeholders}) 
      ORDER BY created_at DESC 
      LIMIT 1
    `).get(...variants)
  },
}

module.exports = paymentInfoService
