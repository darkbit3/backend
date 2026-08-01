const bcrypt             = require('bcryptjs')
const jwt                = require('jsonwebtoken')
const { v4: uuidv4 }     = require('uuid')
const config             = require('../config/config')
const AdminModel         = require('../models/adminModel')
const TokenModel         = require('../models/tokenModel')

function generateTokens(adminId, phone) {
  const accessToken = jwt.sign(
    { id: adminId, phone },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  )
  const refreshToken = jwt.sign(
    { id: adminId, phone },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn }
  )
  return { accessToken, refreshToken }
}

const adminLoginService = {
  async login(phone, password) {
    const admin = AdminModel.findByPhone(phone)
    if (!admin) throw { status: 401, message: 'Invalid phone or password' }

    const isMatch = await bcrypt.compare(password, admin.password)
    if (!isMatch) throw { status: 401, message: 'Invalid phone or password' }

    const { accessToken, refreshToken } = generateTokens(admin.id, admin.phone)

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    TokenModel.save({ id: uuidv4(), token: refreshToken, adminId: admin.id, expiresAt })

    return {
      accessToken,
      refreshToken,
      admin: { id: admin.id, phone: admin.phone, name: admin.name },
    }
  },

  async refresh(refreshToken) {
    if (!refreshToken) throw { status: 401, message: 'Refresh token required' }

    const stored = TokenModel.findByToken(refreshToken)
    if (!stored) throw { status: 403, message: 'Invalid refresh token' }

    const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret)
    const { accessToken, refreshToken: newRefresh } = generateTokens(decoded.id, decoded.phone)

    TokenModel.delete(refreshToken)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    TokenModel.save({ id: uuidv4(), token: newRefresh, adminId: decoded.id, expiresAt })

    return { accessToken, refreshToken: newRefresh }
  },

  logout(refreshToken) {
    if (refreshToken) TokenModel.delete(refreshToken)
  },

  getMe(adminId) {
    const admin = AdminModel.findById(adminId)
    if (!admin) throw { status: 404, message: 'Admin not found' }
    return admin
  },

  async changePassword(adminPhone, currentPassword, newPassword) {
    const admin = AdminModel.findByPhone(adminPhone)
    const isMatch = await bcrypt.compare(currentPassword, admin.password)
    if (!isMatch) throw { status: 400, message: 'Current password is incorrect' }

    const hash = await bcrypt.hash(newPassword, 10)
    AdminModel.updatePassword(admin.id, hash)
  },
}

module.exports = adminLoginService
