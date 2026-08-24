const jwt    = require('jsonwebtoken')
const config = require('../config/config')
const db     = require('../database/db')

// ── Admin auth ────────────────────────────────────────────────────────────────
function authenticate(req, res, next) {
  const token = _extractToken(req)
  if (!token) {
    return res.status(401).json({ success: false, message: 'Access token required' })
  }
  try {
    const decoded = jwt.verify(token, config.jwt.secret)
    if (!decoded.type) {
      const admin = db.prepare('SELECT status FROM admins WHERE id = ?').get(decoded.id)
      if (!admin || admin.status !== 'Active') {
        return res.status(401).json({ success: false, message: 'Admin account is inactive' })
      }
    }
    req.admin = decoded
    next()
  } catch (err) {
    return _tokenError(res, err)
  }
}

// ── User (Manufacturer / Reseller) auth ───────────────────────────────────────
function authenticateUser(req, res, next) {
  const token = _extractToken(req)
  if (!token) {
    return res.status(401).json({ success: false, message: 'Access token required' })
  }
  try {
    const decoded = jwt.verify(token, config.jwt.secret)
    if (decoded.type !== 'user') {
      return res.status(403).json({ success: false, message: 'Invalid token type' })
    }
    req.user = decoded
    next()
  } catch (err) {
    return _tokenError(res, err)
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function _extractToken(req) {
  const authHeader = req.headers['authorization']
  return authHeader && authHeader.split(' ')[1]
}

function _tokenError(res, err) {
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Token expired' })
  }
  return res.status(403).json({ success: false, message: 'Invalid token' })
}

module.exports = { authenticate, authenticateUser }
