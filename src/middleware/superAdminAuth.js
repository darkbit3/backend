const jwt    = require('jsonwebtoken')
const config = require('../config/config')

function authenticateSuperAdmin(req, res, next) {
  const authHeader = req.headers['authorization']
  const token      = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access token required' })
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret)

    if (decoded.type !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Super admin access required' })
    }

    req.superAdmin = decoded
    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired' })
    }
    return res.status(403).json({ success: false, message: 'Invalid token' })
  }
}

module.exports = { authenticateSuperAdmin }
