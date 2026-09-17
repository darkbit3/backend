const bcrypt         = require('bcryptjs')
const jwt            = require('jsonwebtoken')
const { v4: uuidv4 } = require('uuid')
const config         = require('../config/config')
const UserModel      = require('../models/userModel')
const db             = require('../database/db')
const superAdminManageService = require('./super_admin_manage_service')
const paymentInfoService = require('./payment_info_service')
const { normalizePhone } = require('../utils/phone')

function generateTokens(userId, phone, ownerId = null) {
  const accessToken = jwt.sign(
    { id: userId, phone, owner_id: ownerId, type: 'user' },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  )
  const refreshToken = jwt.sign(
    { id: userId, phone, owner_id: ownerId, type: 'user' },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
  )
  return { accessToken, refreshToken }
}

function phoneVariants(phone) {
  const value = String(phone || '').trim()
  const digits = value.replace(/\D/g, '')
  let local = digits

  if (local.startsWith('251')) local = local.slice(3)
  if (local.startsWith('0')) local = local.slice(1)

  if (local.length === 9 && (local[0] === '9' || local[0] === '7')) {
    return ['0' + local, '251' + local, local]
  }

  return [value]
}

function findByPhoneAcrossTables(phone) {
  for (const variant of phoneVariants(phone)) {
    const user = UserModel.findByPhone(variant)
    if (user) return { account: user, table: 'users' }

    const cashier = db.prepare('SELECT * FROM cashiers WHERE phone = ?').get(variant)
    if (cashier) return { account: cashier, table: 'cashiers' }

    const cutter = db.prepare('SELECT * FROM cutters WHERE phone = ?').get(variant)
    if (cutter) return { account: cutter, table: 'cutters' }
  }

  return null
}

// ── AfroMessage SMS helpers ───────────────────────────────────────────────────
//
// Uses the /challenge endpoint to send a 6-digit numeric OTP via SMS
// and /verify to confirm the code the user submits.
//
// Required env vars:
//   AFROMESSAGE_API_KEY    — Bearer token from your AfroMessage dashboard
//   AFROMESSAGE_SENDER_ID  — your approved sender name (e.g. "Shmeta")
//   AFROMESSAGE_IDENTIFIER — your shortcode/identifier id (leave empty to use default)
//
// If AFROMESSAGE_API_KEY is not set the service falls back to dev mode:
//   - generates its own 6-digit code
//   - stores it in-memory
//   - returns the code in the API response (visible only in development)

// Fallback in-memory store used when AfroMessage key is not configured
// { normalizedPhone -> { otp, expiresAt, userId, table } }
const otpStore = new Map()

function toIntlPhone(phone) {
  let digits = String(phone).replace(/\D/g, '')
  if (digits.startsWith('0'))   digits = '251' + digits.slice(1)
  if (!digits.startsWith('251')) digits = '251' + digits
  return digits
}

/**
 * Send OTP via AfroMessage /challenge endpoint.
 * Returns { verificationId, code? } where code is only present in dev-fallback mode.
 */
async function afroSendChallenge(phone) {
  const apiKey    = process.env.AFROMESSAGE_API_KEY
  const senderId  = process.env.AFROMESSAGE_SENDER_ID  || ''
  const fromId    = process.env.AFROMESSAGE_IDENTIFIER || ''
  const intlPhone = toIntlPhone(phone)

  if (!apiKey) {
    // Dev fallback — generate locally, skip SMS
    console.warn('[SMS] AFROMESSAGE_API_KEY not set — using dev fallback (no SMS sent).')
    const otp = String(Math.floor(100000 + Math.random() * 900000))
    return { verificationId: null, devOtp: otp }
  }

  const params = new URLSearchParams({
    from:   fromId,
    sender: senderId,
    to:     intlPhone,
    pr:     'Your Shmeta verification code is',  // prefix before the code
    ps:     '. Valid for 10 minutes. Do not share it.',  // postfix after the code
    sb:     '1',   // 1 space before code
    sa:     '0',   // no space after code (postfix starts with period)
    ttl:    '600', // 10 minutes
    len:    '6',   // 6-digit code
    t:      '0',   // numeric only
  })

  const url = `https://api.afromessage.com/api/challenge?${params.toString()}`

  const res  = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } })
  const data = await res.json()

  if (data?.acknowledge !== 'success') {
    console.error('[SMS] AfroMessage /challenge failed:', JSON.stringify(data))
    throw { status: 502, message: 'Failed to send verification code. Please try again.' }
  }

  console.log(`[SMS] OTP challenge sent to ${intlPhone}, verificationId=${data.response.verificationId}`)
  return { verificationId: data.response.verificationId, devOtp: null }
}

/**
 * Verify OTP via AfroMessage /verify endpoint.
 * Returns true if valid, throws on failure.
 */
async function afroVerifyCode(phone, verificationId, code) {
  const apiKey    = process.env.AFROMESSAGE_API_KEY
  const intlPhone = toIntlPhone(phone)

  if (!apiKey) {
    // Dev fallback — verified by in-memory store (handled by caller)
    return false // signal caller to use local store
  }

  // AfroMessage accepts either `to` OR `vc` (verificationId)
  const params = new URLSearchParams({ to: intlPhone, code })
  if (verificationId) params.set('vc', verificationId)

  const url  = `https://api.afromessage.com/api/verify?${params.toString()}`
  const res  = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } })
  const data = await res.json()

  if (data?.acknowledge !== 'success') {
    console.warn('[SMS] OTP verify failed:', JSON.stringify(data))
    throw { status: 400, message: 'Invalid or expired verification code.' }
  }

  return true
}

const userLoginService = {
  async register(name, phone, password, role, planKey = 'oneMonth') {
    const normalizedPhone = normalizePhone(phone)
    if (!normalizedPhone) throw { status: 400, message: 'Phone must be 09/07, 251, or +251 followed by 9 digits' }
    const registrationPlan = superAdminManageService.getRegisterPlan(planKey)
    const existingUser = UserModel.findByPhone(normalizedPhone)
    const existingCashier = db.prepare('SELECT id FROM cashiers WHERE phone = ?').get(normalizedPhone)
    const existingCutter = db.prepare('SELECT id FROM cutters WHERE phone = ?').get(normalizedPhone)
    if (existingUser || existingCashier || existingCutter) {
      throw { status: 409, message: 'Phone number already registered' }
    }

    const hash = await bcrypt.hash(password, 10)
    const id = uuidv4()
    const isFree = registrationPlan.key === 'oneMonth' && Number(registrationPlan.fee) === 0

    UserModel.create({
      id,
      name,
      phone: normalizedPhone,
      password: hash,
      plainPassword: password,
      role,
      accountType: isFree ? 'Free' : 'Paid',
      adminId: null,
    })

    if (!isFree) {
      // Deactivate user until payment approved by super admin
      db.prepare("UPDATE users SET status = 'Inactive' WHERE id = ?").run(id)
      paymentInfoService.createRegistrationRequest({
        userId: id,
        name,
        phone: normalizedPhone,
        role,
        planKey: registrationPlan.key,
        planLabel: registrationPlan.label,
        fee: registrationPlan.fee,
      })

      const user = UserModel.findById(id)
      return {
        pendingApproval: true,
        registrationFree: false,
        registrationPlan,
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          role: user.role,
          status: 'Pending',
          alertThresholdPercentage: user.alert_threshold_percentage || 20,
        },
        message: 'Registration submitted. Please send payment receipt on Telegram for review.',
      }
    }

    const user = UserModel.findById(id)
    const { accessToken, refreshToken } = generateTokens(id, normalizedPhone, id)
    return {
      pendingApproval: false,
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        status: user.status,
        alertThresholdPercentage: user.alert_threshold_percentage || 20,
      },
      registrationPlan,
      registrationFree: true,
    }
  },

  async login(phone, password) {
    const found = findByPhoneAcrossTables(phone)
    const user = found?.table === 'users' ? found.account : null
    if (user) {
      if (user.status === 'Inactive') {
        const req = paymentInfoService.getLatestRegistrationRequestByPhone(phone)
        if (req && req.status === 'Pending') {
          throw {
            status: 403,
            code: 'REGISTRATION_PENDING',
            message: 'Your registration is awaiting admin approval. Please ensure you sent your payment screenshot on Telegram.',
            plan: req.plan_label,
            fee: req.fee,
          }
        }
        if (req && req.status === 'Rejected') {
          throw {
            status: 403,
            code: 'REGISTRATION_REJECTED',
            message: `Your registration was rejected: ${req.rejection_reason || 'Payment verification could not be confirmed.'}`,
          }
        }
        throw { status: 403, message: 'Your account is inactive. Please contact an admin.' }
      }
      const isMatch = await bcrypt.compare(password, user.password)
      if (!isMatch) throw { status: 401, message: 'Invalid phone or password' }
      const { accessToken, refreshToken } = generateTokens(user.id, user.phone, user.id)
      return { accessToken, refreshToken, user: { id: user.id, name: user.name, phone: user.phone, role: user.role, status: user.status, alertThresholdPercentage: user.alert_threshold_percentage || 20 } }
    }

    // 2. Check cashiers table
    const cashier = found?.table === 'cashiers' ? found.account : null
    if (cashier) {
      if (cashier.status === 'Inactive')
        throw { status: 403, message: 'Your account is inactive. Please contact an admin.' }
      const isMatch = await bcrypt.compare(password, cashier.password)
      if (!isMatch) throw { status: 401, message: 'Invalid phone or password' }
      const { accessToken, refreshToken } = generateTokens(cashier.id, cashier.phone, cashier.owner_id)
      return { accessToken, refreshToken, user: { id: cashier.id, name: cashier.name, phone: cashier.phone, role: 'Cashier', status: cashier.status, owner_id: cashier.owner_id } }
    }

    // 3. Check cutters table
    const cutter = found?.table === 'cutters' ? found.account : null
    if (cutter) {
      if (cutter.status === 'Inactive')
        throw { status: 403, message: 'Your account is inactive. Please contact an admin.' }
      const isMatch = await bcrypt.compare(password, cutter.password)
      if (!isMatch) throw { status: 401, message: 'Invalid phone or password' }
      const { accessToken, refreshToken } = generateTokens(cutter.id, cutter.phone, cutter.owner_id)
      return { accessToken, refreshToken, user: { id: cutter.id, name: cutter.name, phone: cutter.phone, role: 'Cutter', status: cutter.status, owner_id: cutter.owner_id } }
    }

    throw { status: 401, message: 'Invalid phone or password' }
  },

  // ── Forgot password: Step 1 — verify phone exists, send OTP via AfroMessage ─
  async checkPhone(phone) {
    const normalizedPhone = normalizePhone(phone)
    if (!normalizedPhone) throw { status: 400, message: 'Phone must be 09/07, 251, or +251 followed by 9 digits' }

    let found = null
    let table = null

    const user = UserModel.findByPhone(normalizedPhone)
    if (user) { found = user; table = 'users' }

    if (!found) {
      const cashier = db.prepare('SELECT id, name, phone FROM cashiers WHERE phone = ?').get(normalizedPhone)
      if (cashier) { found = cashier; table = 'cashiers' }
    }
    if (!found) {
      const cutter = db.prepare('SELECT id, name, phone FROM cutters WHERE phone = ?').get(normalizedPhone)
      if (cutter) { found = cutter; table = 'cutters' }
    }

    if (!found) throw { status: 404, message: 'No account found with this phone number.' }

    // Send OTP via AfroMessage /challenge (or fallback dev mode)
    const { verificationId, devOtp } = await afroSendChallenge(normalizedPhone)

    // Store verification state so Step 2 can look up userId/table and verificationId
    const expiresAt = Date.now() + 10 * 60 * 1000 // 10 min safety window
    otpStore.set(normalizedPhone, {
      verificationId,
      devOtp,          // non-null only in dev fallback
      expiresAt,
      userId: found.id,
      table,
    })

    const isDev = (process.env.NODE_ENV || 'development') === 'development'
    return {
      name: found.name,
      // Only expose the dev OTP when in dev mode AND no SMS was sent
      ...(isDev && devOtp ? { otp: devOtp } : {}),
    }
  },

  // ── Forgot password: Step 2 — verify OTP, reset password ─────────────────
  async verifyOtp(phone, otp, newPassword) {
    const normalizedPhone = normalizePhone(phone)
    const entry = otpStore.get(normalizedPhone)

    if (!entry)                       throw { status: 400, message: 'No OTP request found. Please request a new code.' }
    if (Date.now() > entry.expiresAt) { otpStore.delete(normalizedPhone); throw { status: 400, message: 'Verification code has expired. Please request a new one.' } }

    if (entry.verificationId) {
      // Production: verify against AfroMessage /verify
      await afroVerifyCode(normalizedPhone, entry.verificationId, otp)
    } else {
      // Dev fallback: verify against local store
      if (entry.devOtp !== otp) throw { status: 400, message: 'Invalid verification code. Please try again.' }
    }

    const hash = await bcrypt.hash(newPassword, 10)

    if (entry.table === 'users') {
      UserModel.updatePassword(entry.userId, hash, newPassword)
    } else if (entry.table === 'cashiers') {
      db.prepare(`UPDATE cashiers SET password=?, plain_password=?, updated_at=NOW() WHERE id=?`).run(hash, newPassword, entry.userId)
    } else {
      db.prepare(`UPDATE cutters SET password=?, plain_password=?, updated_at=NOW() WHERE id=?`).run(hash, newPassword, entry.userId)
    }

    otpStore.delete(normalizedPhone)
    return { message: 'Password reset successfully.' }
  },

  getMe(userId) {
    const user = UserModel.findById(userId)
    if (user) return { id: user.id, name: user.name, phone: user.phone, role: user.role, status: user.status, alertThresholdPercentage: user.alert_threshold_percentage || 20 }

    const cashier = db.prepare('SELECT id, name, phone, status, owner_id FROM cashiers WHERE id = ?').get(userId)
    if (cashier) return { id: cashier.id, name: cashier.name, phone: cashier.phone, role: 'Cashier', status: cashier.status, owner_id: cashier.owner_id }

    const cutter = db.prepare('SELECT id, name, phone, status, owner_id FROM cutters WHERE id = ?').get(userId)
    if (cutter) return { id: cutter.id, name: cutter.name, phone: cutter.phone, role: 'Cutter', status: cutter.status, owner_id: cutter.owner_id }

    throw { status: 404, message: 'User not found' }
  },

  async changePassword(userId, currentPassword, newPassword) {
    const userBase = UserModel.findById(userId)
    if (userBase) {
      const full = UserModel.findByPhone(userBase.phone)
      const isMatch = await bcrypt.compare(currentPassword, full.password)
      if (!isMatch) throw { status: 400, message: 'Current password is incorrect' }
      const hash = await bcrypt.hash(newPassword, 10)
      UserModel.updatePassword(userId, hash, newPassword)
      return
    }
    const cashier = db.prepare('SELECT * FROM cashiers WHERE id = ?').get(userId)
    if (cashier) {
      const isMatch = await bcrypt.compare(currentPassword, cashier.password)
      if (!isMatch) throw { status: 400, message: 'Current password is incorrect' }
      const hash = await bcrypt.hash(newPassword, 10)
      db.prepare(`UPDATE cashiers SET password=?,updated_at=datetime('now') WHERE id=?`).run(hash, userId)
      return
    }
    const cutter = db.prepare('SELECT * FROM cutters WHERE id = ?').get(userId)
    if (cutter) {
      const isMatch = await bcrypt.compare(currentPassword, cutter.password)
      if (!isMatch) throw { status: 400, message: 'Current password is incorrect' }
      const hash = await bcrypt.hash(newPassword, 10)
      db.prepare(`UPDATE cutters SET password=?,updated_at=datetime('now') WHERE id=?`).run(hash, userId)
      return
    }
    throw { status: 404, message: 'User not found' }
  },

  updateAlertThreshold(userId, threshold) {
    const user = UserModel.findById(userId)
    if (!user) throw { status: 404, message: 'User not found' }
    if (user.role !== 'Manufacturer' && user.role !== 'Reseller')
      throw { status: 403, message: 'Only Manufacturer and Reseller can set alert threshold' }
    if (threshold < 5 || threshold > 100)
      throw { status: 400, message: 'Alert threshold must be between 5 and 100' }
    return UserModel.updateAlertThreshold(userId, threshold)
  },
}

module.exports = userLoginService
