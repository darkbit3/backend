const express = require('express')
const router = express.Router()
const chatController = require('../controllers/chat_controller')
const { authenticate, authenticateUser } = require('../middleware/auth')
const { authenticateSuperAdmin } = require('../middleware/superAdminAuth')

router.get('/people', (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ success: false, message: 'Access token required' })

  const token = authHeader.split(' ')[1]
  if (!token) return res.status(401).json({ success: false, message: 'Access token required' })

  try {
    const jwt = require('jsonwebtoken')
    const config = require('../config/config')
    const decoded = jwt.verify(token, config.jwt.secret)
    req.user = decoded
    req.admin = decoded
    req.superAdmin = decoded
    if (decoded.type === 'super_admin') return chatController.getPeopleForSuperAdmin(req, res, next)
    if (decoded.type === 'user') return chatController.getPeopleForUser(req, res, next)
    return chatController.getPeopleForAdmin(req, res, next)
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token' })
  }
})

router.get('/messages/:otherUserId', (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ success: false, message: 'Access token required' })

  const token = authHeader.split(' ')[1]
  if (!token) return res.status(401).json({ success: false, message: 'Access token required' })

  try {
    const jwt = require('jsonwebtoken')
    const config = require('../config/config')
    const decoded = jwt.verify(token, config.jwt.secret)
    req.user = decoded
    req.admin = decoded
    req.superAdmin = decoded
    if (decoded.type === 'super_admin') return chatController.getMessagesForSuperAdmin(req, res, next)
    if (decoded.type === 'user') return chatController.getMessagesForUser(req, res, next)
    return chatController.getMessagesForAdmin(req, res, next)
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token' })
  }
})

router.post('/send', (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader) return res.status(401).json({ success: false, message: 'Access token required' })

  const token = authHeader.split(' ')[1]
  if (!token) return res.status(401).json({ success: false, message: 'Access token required' })

  try {
    const jwt = require('jsonwebtoken')
    const config = require('../config/config')
    const decoded = jwt.verify(token, config.jwt.secret)
    req.user = decoded
    req.admin = decoded
    req.superAdmin = decoded
    if (decoded.type === 'super_admin') return chatController.sendMessageAsSuperAdmin(req, res, next)
    if (decoded.type === 'user') return chatController.sendMessageAsUser(req, res, next)
    return chatController.sendMessageAsAdmin(req, res, next)
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token' })
  }
})

module.exports = router
