const db = require('../database/db')
const { v4: uuidv4 } = require('uuid')

function normalizeRole(role) {
  if (role === 'super_admin') return 'super_admin'
  if (role === 'admin') return 'admin'
  return 'user'
}

function deriveDisplayName(record) {
  return record?.name || record?.phone || 'Unknown'
}

function buildPersonList({ records, currentUserId, currentRole, search = '' }) {
  const query = search.trim().toLowerCase()
  return (records || [])
    .filter((person) => {
      if (person.id === currentUserId && person.role === currentRole) return false
      if (!query) return true
      const haystack = `${person.name || ''} ${person.role || ''}`.toLowerCase()
      return haystack.includes(query)
    })
    .map((person) => ({
      id: person.id,
      name: person.name,
      role: person.role,
      status: person.status || 'Active',
      avatar: (person.name || 'U').split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase() || 'U',
      color: person.color || '#7C3AED',
      phone: person.phone || null,
      isSuperAdmin: person._isSuperAdmin === true || person.role === 'Super Admin',
    }))
}

function getChatPeopleForRole(type, currentUserId, search = '') {
  if (type === 'admin') {
    // Own users (Manufacturer/Reseller under this admin)
    const userRows = db.prepare(`
      SELECT u.id, u.name, u.phone, u.role, u.status
      FROM users u
      WHERE u.admin_id = ?
      ORDER BY u.name ASC
    `).all(currentUserId)

    // All super admins — admins can message the super admin
    const superAdminRows = db.prepare(`
      SELECT sa.id, sa.name, sa.phone, 'Super Admin' AS role, 'Active' AS status
      FROM super_admins sa
      ORDER BY sa.name ASC
    `).all()

    const allRows = [
      ...superAdminRows.map(r => ({ ...r, _isSuperAdmin: true })),
      ...userRows,
    ]
    return buildPersonList({ records: allRows, currentUserId, currentRole: 'admin', search })
  }

  if (type === 'super_admin') {
    const rows = db.prepare(`
      SELECT a.id, a.name, a.phone, 'Admin' AS role, a.status
      FROM admins a
      UNION ALL
      SELECT u.id, u.name, u.phone, u.role, u.status
      FROM users u
      ORDER BY name ASC
    `).all()
    return buildPersonList({ records: rows, currentUserId, currentRole: 'super_admin', search })
  }

  const rows = db.prepare(`
    SELECT a.id, a.name, a.phone, 'Admin' AS role, a.status
    FROM admins a
    WHERE a.status = 'Active'
    UNION ALL
    SELECT u.id, u.name, u.phone, u.role, u.status
    FROM users u
    WHERE u.status = 'Active' AND u.id != ?
    ORDER BY name ASC
  `).all(currentUserId)
  return buildPersonList({ records: rows, currentUserId, currentRole: 'user', search })
}

function getConversationRecords(currentUserId, currentRole, otherUserId) {
  return db.prepare(`
    SELECT
      id,
      sender_id,
      sender_role,
      receiver_id,
      receiver_role,
      message,
      created_at
    FROM chat_messages
    WHERE (
      (sender_id = ? AND receiver_id = ?) OR
      (sender_id = ? AND receiver_id = ?)
    )
    ORDER BY created_at ASC
  `).all(currentUserId, otherUserId, otherUserId, currentUserId)
}

const chatController = {
  getPeopleForAdmin(req, res, next) {
    try {
      const search = req.query.search || ''
      const people = getChatPeopleForRole('admin', req.admin.id, search)
      res.json({ success: true, data: people })
    } catch (err) {
      next(err)
    }
  },

  getPeopleForSuperAdmin(req, res, next) {
    try {
      const search = req.query.search || ''
      const people = getChatPeopleForRole('super_admin', req.superAdmin.id, search)
      res.json({ success: true, data: people })
    } catch (err) {
      next(err)
    }
  },

  getPeopleForUser(req, res, next) {
    try {
      const search = req.query.search || ''
      const people = getChatPeopleForRole('user', req.user.id, search)
      res.json({ success: true, data: people })
    } catch (err) {
      next(err)
    }
  },

  getMessagesForAdmin(req, res, next) {
    try {
      const currentUserId = req.admin.id
      const currentRole = 'admin'
      const messages = getConversationRecords(currentUserId, currentRole, req.params.otherUserId)
      const data = messages.map((msg) => ({
        id: msg.id,
        senderId: msg.sender_id,
        senderRole: msg.sender_role,
        receiverId: msg.receiver_id,
        receiverRole: msg.receiver_role,
        message: msg.message,
        createdAt: msg.created_at,
        isMine: msg.sender_id === currentUserId && msg.sender_role === currentRole,
      }))
      res.json({ success: true, data })
    } catch (err) {
      next(err)
    }
  },

  getMessagesForSuperAdmin(req, res, next) {
    try {
      const currentUserId = req.superAdmin.id
      const currentRole = 'super_admin'
      const messages = getConversationRecords(currentUserId, currentRole, req.params.otherUserId)
      const data = messages.map((msg) => ({
        id: msg.id,
        senderId: msg.sender_id,
        senderRole: msg.sender_role,
        receiverId: msg.receiver_id,
        receiverRole: msg.receiver_role,
        message: msg.message,
        createdAt: msg.created_at,
        isMine: msg.sender_id === currentUserId && msg.sender_role === currentRole,
      }))
      res.json({ success: true, data })
    } catch (err) {
      next(err)
    }
  },

  getMessagesForUser(req, res, next) {
    try {
      const currentUserId = req.user.id
      const currentRole = 'user'
      const messages = getConversationRecords(currentUserId, currentRole, req.params.otherUserId)
      const data = messages.map((msg) => ({
        id: msg.id,
        senderId: msg.sender_id,
        senderRole: msg.sender_role,
        receiverId: msg.receiver_id,
        receiverRole: msg.receiver_role,
        message: msg.message,
        createdAt: msg.created_at,
        isMine: msg.sender_id === currentUserId && msg.sender_role === currentRole,
      }))
      res.json({ success: true, data })
    } catch (err) {
      next(err)
    }
  },

  sendMessageAsAdmin(req, res, next) {
    try {
      const { receiverId, message, receiverRole } = req.body
      if (!receiverId || !message || !String(message).trim()) {
        return res.status(400).json({ success: false, message: 'receiverId and message are required' })
      }
      // Determine if receiver is a super admin or regular user
      const isSuperAdminReceiver = receiverRole === 'super_admin' || (() => {
        const sa = db.prepare('SELECT id FROM super_admins WHERE id = ?').get(receiverId)
        return !!sa
      })()
      const row = {
        id: uuidv4(),
        sender_id: req.admin.id,
        sender_role: 'admin',
        receiver_id: receiverId,
        receiver_role: isSuperAdminReceiver ? 'super_admin' : 'user',
        message: String(message).trim(),
        created_at: new Date().toISOString(),
      }
      db.prepare(`INSERT INTO chat_messages (id, sender_id, sender_role, receiver_id, receiver_role, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(row.id, row.sender_id, row.sender_role, row.receiver_id, row.receiver_role, row.message, row.created_at)
      res.status(201).json({ success: true, data: row })
    } catch (err) {
      next(err)
    }
  },

  sendMessageAsSuperAdmin(req, res, next) {
    try {
      const { receiverId, message, receiverRole } = req.body
      if (!receiverId || !message || !String(message).trim()) {
        return res.status(400).json({ success: false, message: 'receiverId and message are required' })
      }
      // Determine receiver role: admin or user
      const isAdminReceiver = receiverRole === 'admin' || (() => {
        const adm = db.prepare('SELECT id FROM admins WHERE id = ?').get(receiverId)
        return !!adm
      })()
      const row = {
        id: uuidv4(),
        sender_id: req.superAdmin.id,
        sender_role: 'super_admin',
        receiver_id: receiverId,
        receiver_role: isAdminReceiver ? 'admin' : 'user',
        message: String(message).trim(),
        created_at: new Date().toISOString(),
      }
      db.prepare(`INSERT INTO chat_messages (id, sender_id, sender_role, receiver_id, receiver_role, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(row.id, row.sender_id, row.sender_role, row.receiver_id, row.receiver_role, row.message, row.created_at)
      res.status(201).json({ success: true, data: row })
    } catch (err) {
      next(err)
    }
  },

  sendMessageAsUser(req, res, next) {
    try {
      const { receiverId, message } = req.body
      if (!receiverId || !message || !String(message).trim()) {
        return res.status(400).json({ success: false, message: 'receiverId and message are required' })
      }
      const row = { id: uuidv4(), sender_id: req.user.id, sender_role: 'user', receiver_id: receiverId, receiver_role: 'admin', message: String(message).trim(), created_at: new Date().toISOString() }
      db.prepare(`INSERT INTO chat_messages (id, sender_id, sender_role, receiver_id, receiver_role, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .run(row.id, row.sender_id, row.sender_role, row.receiver_id, row.receiver_role, row.message, row.created_at)
      res.status(201).json({ success: true, data: row })
    } catch (err) {
      next(err)
    }
  },
}

module.exports = chatController
