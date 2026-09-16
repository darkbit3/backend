const bcrypt             = require('bcryptjs')
const jwt                = require('jsonwebtoken')
const { v4: uuidv4 }     = require('uuid')
const config             = require('../config/config')
const SuperAdminModel    = require('../models/superAdminModel')
const db                 = require('../database/db')
const { sendSuperAdminOtp } = require('./email_service')

const otpStore = new Map()
const OTP_TTL_MS = 10 * 60 * 1000

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function generateTokens(adminId, phone) {
  const payload = { id: adminId, phone, type: 'super_admin' }
  const accessToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  })
  const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  })
  return { accessToken, refreshToken }
}

const superAdminLoginService = {
  async login(phone, password) {
    const isPhone = !/[a-zA-Z]/.test(phone) && /^\d+$/.test(String(phone).replace(/[\s\-().+]/g, ''))
    const authErrorMessage = isPhone ? 'Invalid phone number or password' : 'Invalid username or password'

    const admin = SuperAdminModel.findByPhone(phone)
    if (!admin) throw { status: 401, message: authErrorMessage }

    const isMatch = await bcrypt.compare(password, admin.password)
    if (!isMatch) throw { status: 401, message: authErrorMessage }

    const { accessToken, refreshToken } = generateTokens(admin.id, admin.phone)

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    db.prepare(`
      INSERT INTO super_admin_tokens (id, token, super_admin_id, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(uuidv4(), refreshToken, admin.id, expiresAt)

    return {
      accessToken,
      refreshToken,
      admin: { id: admin.id, phone: admin.phone, name: admin.name },
    }
  },

  async refresh(refreshToken) {
    if (!refreshToken) throw { status: 401, message: 'Refresh token required' }

    const stored = db.prepare('SELECT * FROM super_admin_tokens WHERE token = ?').get(refreshToken)
    if (!stored) throw { status: 403, message: 'Invalid refresh token' }

    let decoded
    try {
      decoded = jwt.verify(refreshToken, config.jwt.refreshSecret)
    } catch (_) {
      db.prepare('DELETE FROM super_admin_tokens WHERE token = ?').run(refreshToken)
      throw { status: 401, message: 'Invalid or expired refresh token' }
    }
    const { accessToken, refreshToken: newRefresh } = generateTokens(decoded.id, decoded.phone)

    db.prepare('DELETE FROM super_admin_tokens WHERE token = ?').run(refreshToken)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    db.prepare(`
      INSERT INTO super_admin_tokens (id, token, super_admin_id, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(uuidv4(), newRefresh, decoded.id, expiresAt)

    return { accessToken, refreshToken: newRefresh }
  },

  logout(refreshToken) {
    if (refreshToken) {
      db.prepare('DELETE FROM super_admin_tokens WHERE token = ?').run(refreshToken)
    }
  },

  getMe(adminId) {
    const admin = SuperAdminModel.findById(adminId)
    if (!admin) throw { status: 404, message: 'Super admin not found' }
    return admin
  },

  async changePassword(adminPhone, currentPassword, newPassword) {
    const admin = SuperAdminModel.findByPhone(adminPhone)
    if (!admin) throw { status: 404, message: 'Super admin not found' }
    const isMatch = await bcrypt.compare(currentPassword, admin.password)
    if (!isMatch) throw { status: 400, message: 'Current password is incorrect' }
    const hash = await bcrypt.hash(newPassword, 10)
    SuperAdminModel.updatePassword(admin.id, hash)
  },

  async checkEmail(email) {
    const normalizedEmail = String(email || '').trim().toLowerCase()
    const admin = SuperAdminModel.findByEmail(normalizedEmail)
    if (!admin) throw { status: 404, message: 'No super admin found with this email address.' }

    const otp = generateOtp()
    otpStore.set(normalizedEmail, { otp, expiresAt: Date.now() + OTP_TTL_MS, adminId: admin.id })
    try {
      const delivery = await sendSuperAdminOtp(normalizedEmail, otp)
      return {
        email: normalizedEmail,
        otp: delivery.delivered ? undefined : otp,
        delivered: delivery.delivered,
        expiresInSeconds: OTP_TTL_MS / 1000,
      }
    } catch (err) {
      otpStore.delete(normalizedEmail)
      throw err
    }
  },

  async verifyEmailOtp(email, otp, newPassword) {
    const normalizedEmail = String(email || '').trim().toLowerCase()
    const entry = otpStore.get(normalizedEmail)
    if (!entry) throw { status: 400, message: 'No OTP request found. Please request again.' }
    if (Date.now() > entry.expiresAt) {
      otpStore.delete(normalizedEmail)
      throw { status: 400, message: 'OTP has expired. Please request again.' }
    }
    if (entry.otp !== String(otp)) throw { status: 400, message: 'Invalid OTP. Please try again.' }

    const hash = await bcrypt.hash(newPassword, 10)
    const admin = SuperAdminModel.findByEmail(normalizedEmail)
    if (!admin || admin.id !== entry.adminId) throw { status: 404, message: 'Super admin not found' }
    SuperAdminModel.updatePassword(admin.id, hash)
    otpStore.delete(normalizedEmail)
  },
}

module.exports = superAdminLoginService
