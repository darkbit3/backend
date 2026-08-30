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
    const userRows = db.prepare(`
      SELECT u.id, u.name, u.phone, u.role, u.status
      FROM users u
      WHERE u.admin_id = ?
      ORDER BY u.name ASC
    `).all(currentUserId)

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
  // Mark incoming messages as read when retrieved
  const messages = db.prepare(`
    SELECT
      id,
      sender_id,
      sender_role,
      receiver_id,
      receiver_role,
      message,
      status,
      created_at
    FROM chat_messages
    WHERE (
      (sender_id = ? AND receiver_id = ?) OR
      (sender_id = ? AND receiver_id = ?)
    )
    ORDER BY created_at ASC
  `).all(currentUserId, otherUserId, otherUserId, currentUserId)

  // Mark all incoming messages (not from current user) as read
  db.prepare(`
    UPDATE chat_messages
    SET status = 'read'
    WHERE receiver_id = ? AND sender_id = ? AND status = 'sent'
  `).run(currentUserId, otherUserId)

  return messages
}

function formatGroupRow(group) {
  return {
    id: group.id,
    name: group.name,
    description: group.description || '',
    createdBy: group.created_by,
    invitedBy: group.invited_by || group.created_by_name || 'Super Admin',
    createdAt: group.created_at,
    memberCount: Number(group.member_count || 0),
  }
}

function getGroupMembers(groupId) {
  return db.prepare(`
    SELECT gm.user_id, gm.user_role, a.name AS admin_name, u.name AS user_name
    FROM chat_group_members gm
    LEFT JOIN admins a ON a.id = gm.user_id AND gm.user_role = 'admin'
    LEFT JOIN users u ON u.id = gm.user_id AND gm.user_role = 'user'
    WHERE gm.group_id = ?
    ORDER BY gm.joined_at ASC
  `).all(groupId).map((member) => ({
    id: member.user_id,
    role: member.user_role,
    name: member.user_role === 'admin' ? member.admin_name : member.user_name,
  }))
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

  getGroupsForSuperAdmin(req, res, next) {
    try {
      const groups = db.prepare(`
        SELECT g.id, g.name, g.description, g.created_by, g.created_at,
               COUNT(m.id) AS member_count,
               sa.name AS created_by_name
        FROM chat_groups g
        LEFT JOIN chat_group_members m ON m.group_id = g.id
        LEFT JOIN super_admins sa ON sa.id = g.created_by
        WHERE g.created_by = ?
        GROUP BY g.id, g.name, g.description, g.created_by, g.created_at, sa.name
        ORDER BY g.created_at DESC
      `).all(req.superAdmin.id)

      const data = groups.map((group) => ({
        ...formatGroupRow(group),
        members: getGroupMembers(group.id),
      }))

      res.json({ success: true, data })
    } catch (err) {
      next(err)
    }
  },

  getGroupsForAdmin(req, res, next) {
    try {
      const groups = db.prepare(`
        SELECT g.id, g.name, g.description, g.created_by, g.created_at,
               COUNT(m.id) AS member_count,
               sa.name AS invited_by
        FROM chat_group_members gm
        JOIN chat_groups g ON g.id = gm.group_id
        LEFT JOIN chat_group_members m ON m.group_id = g.id
        LEFT JOIN super_admins sa ON sa.id = g.created_by
        WHERE gm.user_id = ? AND gm.user_role = 'admin'
        GROUP BY g.id, g.name, g.description, g.created_by, g.created_at, sa.name
        ORDER BY g.created_at DESC
      `).all(req.admin.id)

      const data = groups.map((group) => ({
        ...formatGroupRow(group),
        invitedBy: group.invited_by || 'Super Admin',
        members: getGroupMembers(group.id),
      }))

      res.json({ success: true, data })
    } catch (err) {
      next(err)
    }
  },

  createGroupForSuperAdmin(req, res, next) {
    try {
      const { name, description, memberIds = [] } = req.body
      if (!name || !String(name).trim()) {
        return res.status(400).json({ success: false, message: 'Group name is required' })
      }
      if (!Array.isArray(memberIds) || memberIds.length === 0) {
        return res.status(400).json({ success: false, message: 'At least one user must be added to the group' })
      }

      const uniqueMembers = [...new Set(memberIds.filter(Boolean))]
      const groupId = uuidv4()
      db.prepare(`
        INSERT INTO chat_groups (id, name, description, created_by, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(groupId, String(name).trim(), description ? String(description).trim() : '', req.superAdmin.id, new Date().toISOString())

      const insertMember = db.prepare(`
        INSERT INTO chat_group_members (id, group_id, user_id, user_role, joined_at)
        VALUES (?, ?, ?, ?, ?)
      `)

      uniqueMembers.forEach((memberId) => {
        const adminRow = db.prepare('SELECT id FROM admins WHERE id = ?').get(memberId)
        const userRow = db.prepare('SELECT id FROM users WHERE id = ?').get(memberId)
        if (!adminRow && !userRow) return

        insertMember.run(uuidv4(), groupId, memberId, adminRow ? 'admin' : 'user', new Date().toISOString())
      })

      const created = db.prepare(`
        SELECT g.id, g.name, g.description, g.created_by, g.created_at,
               COUNT(m.id) AS member_count,
               sa.name AS created_by_name
        FROM chat_groups g
        LEFT JOIN chat_group_members m ON m.group_id = g.id
        LEFT JOIN super_admins sa ON sa.id = g.created_by
        WHERE g.id = ?
        GROUP BY g.id, g.name, g.description, g.created_by, g.created_at, sa.name
      `).get(groupId)

      res.status(201).json({
        success: true,
        data: {
          ...formatGroupRow(created),
          members: getGroupMembers(groupId),
        },
      })
    } catch (err) {
      next(err)
    }
  },

  getGroupMessagesForSuperAdmin(req, res, next) {
    try {
      const { groupId } = req.params
      const group = db.prepare('SELECT * FROM chat_groups WHERE id = ? AND created_by = ?').get(groupId, req.superAdmin.id)
      if (!group) {
        return res.status(404).json({ success: false, message: 'Group not found' })
      }

      const rows = db.prepare(`
        SELECT id, sender_id, sender_role, message, status, created_at
        FROM chat_group_messages
        WHERE group_id = ?
        ORDER BY created_at ASC
      `).all(groupId)

      // Mark all messages as read when retrieved
      db.prepare(`
        UPDATE chat_group_messages
        SET status = 'read'
        WHERE group_id = ? AND status = 'sent'
      `).run(groupId)

      const data = rows.map((msg) => ({
        id: msg.id,
        senderId: msg.sender_id,
        senderRole: msg.sender_role,
        message: msg.message,
        status: msg.status,
        createdAt: msg.created_at,
        isMine: msg.sender_id === req.superAdmin.id && msg.sender_role === 'super_admin',
      }))
      res.json({ success: true, data })
    } catch (err) {
      next(err)
    }
  },

  getGroupMessagesForAdmin(req, res, next) {
    try {
      const { groupId } = req.params
      const membership = db.prepare(`
        SELECT id FROM chat_group_members WHERE group_id = ? AND user_id = ? AND user_role = 'admin'
      `).get(groupId, req.admin.id)

      if (!membership) {
        return res.status(404).json({ success: false, message: 'Group not found or you are not a member' })
      }

      const rows = db.prepare(`
        SELECT id, sender_id, sender_role, message, status, created_at
        FROM chat_group_messages
        WHERE group_id = ?
        ORDER BY created_at ASC
      `).all(groupId)

      // Mark all messages as read when retrieved
      db.prepare(`
        UPDATE chat_group_messages
        SET status = 'read'
        WHERE group_id = ? AND status = 'sent'
      `).run(groupId)

      const data = rows.map((msg) => ({
        id: msg.id,
        senderId: msg.sender_id,
        senderRole: msg.sender_role,
        message: msg.message,
        status: msg.status,
        createdAt: msg.created_at,
        isMine: msg.sender_id === req.admin.id && msg.sender_role === 'admin',
      }))
      res.json({ success: true, data })
    } catch (err) {
      next(err)
    }
  },

  sendGroupMessageForSuperAdmin(req, res, next) {
    try {
      const { groupId } = req.params
      const { message } = req.body
      if (!message || !String(message).trim()) {
        return res.status(400).json({ success: false, message: 'Message text is required' })
      }

      const group = db.prepare('SELECT * FROM chat_groups WHERE id = ? AND created_by = ?').get(groupId, req.superAdmin.id)
      if (!group) {
        return res.status(404).json({ success: false, message: 'Group not found' })
      }

      const row = {
        id: uuidv4(),
        group_id: groupId,
        sender_id: req.superAdmin.id,
        sender_role: 'super_admin',
        message: String(message).trim(),
        created_at: new Date().toISOString(),
      }

      db.prepare(`
        INSERT INTO chat_group_messages (id, group_id, sender_id, sender_role, message, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(row.id, row.group_id, row.sender_id, row.sender_role, row.message, row.created_at)

      res.status(201).json({ success: true, data: row })
    } catch (err) {
      next(err)
    }
  },

  sendGroupMessageForAdmin(req, res, next) {
    try {
      const { groupId } = req.params
      const { message } = req.body
      if (!message || !String(message).trim()) {
        return res.status(400).json({ success: false, message: 'Message text is required' })
      }

      const membership = db.prepare(`
        SELECT id FROM chat_group_members WHERE group_id = ? AND user_id = ? AND user_role = 'admin'
      `).get(groupId, req.admin.id)

      if (!membership) {
        return res.status(404).json({ success: false, message: 'Group not found or you are not a member' })
      }

      const row = {
        id: uuidv4(),
        group_id: groupId,
        sender_id: req.admin.id,
        sender_role: 'admin',
        message: String(message).trim(),
        created_at: new Date().toISOString(),
      }

      db.prepare(`
        INSERT INTO chat_group_messages (id, group_id, sender_id, sender_role, message, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(row.id, row.group_id, row.sender_id, row.sender_role, row.message, row.created_at)

      res.status(201).json({ success: true, data: row })
    } catch (err) {
      next(err)
    }
  },
}

module.exports = chatController
