const bcrypt         = require('bcryptjs')
const jwt            = require('jsonwebtoken')
const config         = require('../config/config')
const UserModel      = require('../models/userModel')
const db             = require('../database/db')

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

// ── In-memory OTP store: { phone -> { otp, expiresAt, userId, table } } ──────
const otpStore = new Map()

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

const userLoginService = {
  async login(phone, password) {
    // 1. Check main users table (Manufacturer / Reseller)
    const user = UserModel.findByPhone(phone)
    if (user) {
      if (user.status === 'Inactive')
        throw { status: 403, message: 'Your account is inactive. Please contact an admin.' }
      const isMatch = await bcrypt.compare(password, user.password)
      if (!isMatch) throw { status: 401, message: 'Invalid phone or password' }
      const { accessToken, refreshToken } = generateTokens(user.id, user.phone, user.id)
      return { accessToken, refreshToken, user: { id: user.id, name: user.name, phone: user.phone, role: user.role, status: user.status, alertThresholdPercentage: user.alert_threshold_percentage || 20 } }
    }

    // 2. Check cashiers table
    const cashier = db.prepare('SELECT * FROM cashiers WHERE phone = ?').get(phone)
    if (cashier) {
      if (cashier.status === 'Inactive')
        throw { status: 403, message: 'Your account is inactive. Please contact an admin.' }
      const isMatch = await bcrypt.compare(password, cashier.password)
      if (!isMatch) throw { status: 401, message: 'Invalid phone or password' }
      const { accessToken, refreshToken } = generateTokens(cashier.id, cashier.phone, cashier.owner_id)
      return { accessToken, refreshToken, user: { id: cashier.id, name: cashier.name, phone: cashier.phone, role: 'Cashier', status: cashier.status, owner_id: cashier.owner_id } }
    }

    // 3. Check cutters table
    const cutter = db.prepare('SELECT * FROM cutters WHERE phone = ?').get(phone)
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

  // ── Forgot password: Step 1 — verify phone exists, issue OTP ─────────────
  checkPhone(phone) {
    let found = null
    let table = null

    const user = UserModel.findByPhone(phone)
    if (user) { found = user; table = 'users' }

    if (!found) {
      const cashier = db.prepare('SELECT id, name, phone FROM cashiers WHERE phone = ?').get(phone)
      if (cashier) { found = cashier; table = 'cashiers' }
    }
    if (!found) {
      const cutter = db.prepare('SELECT id, name, phone FROM cutters WHERE phone = ?').get(phone)
      if (cutter) { found = cutter; table = 'cutters' }
    }

    if (!found) throw { status: 404, message: 'No account found with this phone number.' }

    const otp       = generateOtp()
    const expiresAt = Date.now() + 5 * 60 * 1000 // 5 minutes
    otpStore.set(phone, { otp, expiresAt, userId: found.id, table })

    // In production replace this with real SMS. For now we return the OTP.
    console.log(`[OTP] Phone ${phone} → OTP ${otp}`)
    return { name: found.name, otp }
  },

  // ── Forgot password: Step 2 — verify OTP, reset password ─────────────────
  async verifyOtp(phone, otp, newPassword) {
    const entry = otpStore.get(phone)
    if (!entry)                       throw { status: 400, message: 'No OTP request found. Please request again.' }
    if (Date.now() > entry.expiresAt) { otpStore.delete(phone); throw { status: 400, message: 'OTP has expired. Please request again.' } }
    if (entry.otp !== otp)            throw { status: 400, message: 'Invalid OTP. Please try again.' }

    const hash = await bcrypt.hash(newPassword, 10)

    if (entry.table === 'users') {
      UserModel.updatePassword(entry.userId, hash, newPassword)
    } else if (entry.table === 'cashiers') {
      db.prepare(`UPDATE cashiers SET password=?, plain_password=?, updated_at=datetime('now') WHERE id=?`).run(hash, newPassword, entry.userId)
    } else {
      db.prepare(`UPDATE cutters SET password=?, plain_password=?, updated_at=datetime('now') WHERE id=?`).run(hash, newPassword, entry.userId)
    }

    otpStore.delete(phone)
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

module.exports = userLoginService
