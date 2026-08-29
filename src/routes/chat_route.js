const express = require('express')
const router = express.Router()
const chatController = require('../controllers/chat_controller')
const { authenticateSuperAdmin } = require('../middleware/superAdminAuth')

function attachDecodedUser(req) {
  const authHeader = req.headers.authorization
  if (!authHeader) throw new Error('Access token required')

  const token = authHeader.split(' ')[1]
  if (!token) throw new Error('Access token required')

  const jwt = require('jsonwebtoken')
  const config = require('../config/config')
  const decoded = jwt.verify(token, config.jwt.secret)
  req.user = decoded
  req.admin = decoded
  req.superAdmin = decoded
  return decoded
}

router.get('/people', (req, res, next) => {
  try {
    const decoded = attachDecodedUser(req)
    if (decoded.type === 'super_admin') return chatController.getPeopleForSuperAdmin(req, res, next)
    if (decoded.type === 'user') return chatController.getPeopleForUser(req, res, next)
    return chatController.getPeopleForAdmin(req, res, next)
  } catch (err) {
    return res.status(401).json({ success: false, message: err.message || 'Invalid token' })
  }
})

router.get('/messages/:otherUserId', (req, res, next) => {
  try {
    const decoded = attachDecodedUser(req)
    if (decoded.type === 'super_admin') return chatController.getMessagesForSuperAdmin(req, res, next)
    if (decoded.type === 'user') return chatController.getMessagesForUser(req, res, next)
    return chatController.getMessagesForAdmin(req, res, next)
  } catch (err) {
    return res.status(401).json({ success: false, message: err.message || 'Invalid token' })
  }
})

router.post('/send', (req, res, next) => {
  try {
    const decoded = attachDecodedUser(req)
    if (decoded.type === 'super_admin') return chatController.sendMessageAsSuperAdmin(req, res, next)
    if (decoded.type === 'user') return chatController.sendMessageAsUser(req, res, next)
    return chatController.sendMessageAsAdmin(req, res, next)
  } catch (err) {
    return res.status(401).json({ success: false, message: err.message || 'Invalid token' })
  }
})

router.get('/groups', (req, res, next) => {
  try {
    const decoded = attachDecodedUser(req)
    if (decoded.type === 'super_admin') return chatController.getGroupsForSuperAdmin(req, res, next)
    if (decoded.type === 'admin' || !decoded.type) return chatController.getGroupsForAdmin(req, res, next)
    return res.status(403).json({ success: false, message: 'Groups are only available for admin and super admin roles' })
  } catch (err) {
    return res.status(401).json({ success: false, message: err.message || 'Invalid token' })
  }
})

router.post('/groups', authenticateSuperAdmin, chatController.createGroupForSuperAdmin)
router.get('/groups/:groupId/messages', (req, res, next) => {
  try {
    const decoded = attachDecodedUser(req)
    if (decoded.type === 'super_admin') return chatController.getGroupMessagesForSuperAdmin(req, res, next)
    if (decoded.type === 'admin' || !decoded.type) return chatController.getGroupMessagesForAdmin(req, res, next)
    return res.status(403).json({ success: false, message: 'Group messages are only available for admin and super admin roles' })
  } catch (err) {
    return res.status(401).json({ success: false, message: err.message || 'Invalid token' })
  }
})
router.post('/groups/:groupId/send', (req, res, next) => {
  try {
    const decoded = attachDecodedUser(req)
    if (decoded.type === 'super_admin') return chatController.sendGroupMessageForSuperAdmin(req, res, next)
    if (decoded.type === 'admin' || !decoded.type) return chatController.sendGroupMessageForAdmin(req, res, next)
    return res.status(403).json({ success: false, message: 'Group messages are only available for admin and super admin roles' })
  } catch (err) {
    return res.status(401).json({ success: false, message: err.message || 'Invalid token' })
  }
})

module.exports = router
