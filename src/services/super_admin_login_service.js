const bcrypt             = require('bcryptjs')
const jwt                = require('jsonwebtoken')
const { v4: uuidv4 }     = require('uuid')
const config             = require('../config/config')
const SuperAdminModel    = require('../models/superAdminModel')
const db                 = require('../database/db')

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
    const admin = SuperAdminModel.findByPhone(phone)
    if (!admin) throw { status: 401, message: 'Invalid phone or password' }

    const isMatch = await bcrypt.compare(password, admin.password)
    if (!isMatch) throw { status: 401, message: 'Invalid phone or password' }

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
}

module.exports = superAdminLoginService
