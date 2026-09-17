const db = require('../database/db')
const { v4: uuidv4 } = require('uuid')

const CHAT_VISIBILITY_KEYS = {
  hidePeople: 'chat_hide_people',
  hideGroups: 'chat_hide_groups',
}

function getChatVisibility() {
  const rows = db.prepare(
    'SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN (?, ?)'
  ).all(CHAT_VISIBILITY_KEYS.hidePeople, CHAT_VISIBILITY_KEYS.hideGroups)
  const values = Object.fromEntries(rows.map((row) => [row.setting_key, row.setting_value]))
  return {
    hidePeople: values[CHAT_VISIBILITY_KEYS.hidePeople] === 'true',
    hideGroups: values[CHAT_VISIBILITY_KEYS.hideGroups] === 'true',
  }
}

function setChatVisibility({ hidePeople, hideGroups }) {
  const now = new Date().toISOString()
  const upsert = db.prepare(`
    INSERT INTO system_settings (id, setting_key, setting_value, description, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(setting_key) DO UPDATE SET
      setting_value = excluded.setting_value,
      description = excluded.description,
      updated_at = excluded.updated_at
  `)
  const run = db.transaction(() => {
    upsert.run(uuidv4(), CHAT_VISIBILITY_KEYS.hidePeople, String(hidePeople), 'Hide people from all chat pages', now, now)
    upsert.run(uuidv4(), CHAT_VISIBILITY_KEYS.hideGroups, String(hideGroups), 'Hide groups from all chat pages', now, now)
  })
  run()
  return getChatVisibility()
}

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
  if (getChatVisibility().hidePeople) return []
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

// ─────────────────────────────────────────────────────────────────────────────
// FIXED GROUPS HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const FIXED_GROUP_IDS = ['group-cherk', 'group-general', 'group-business', 'group-support']

/** All admins + all users are considered members of every fixed group */
function isFixedGroupMember(groupId, userId, userRole) {
  if (!FIXED_GROUP_IDS.includes(groupId)) return false
  if (userRole === 'admin') {
    return !!db.prepare('SELECT id FROM admins WHERE id = ?').get(userId)
  }
  if (userRole === 'user') {
    return !!db.prepare('SELECT id FROM users WHERE id = ?').get(userId)
  }
  if (userRole === 'super_admin') {
    return !!db.prepare('SELECT id FROM super_admins WHERE id = ?').get(userId)
  }
  return false
}

function getFixedGroupWithCategories(groupId) {
  const group = db.prepare('SELECT * FROM chat_groups WHERE id = ?').get(groupId)
  if (!group) return null
  const categories = db.prepare(`
    SELECT id, name, image_url, created_by, created_at
    FROM group_categories
    WHERE group_id = ?
    ORDER BY created_at ASC
  `).all(groupId)
  const adminCount = db.prepare('SELECT COUNT(*) AS c FROM admins').get().c
  const userCount  = db.prepare('SELECT COUNT(*) AS c FROM users').get().c
  return {
    id:          group.id,
    name:        group.name,
    description: group.description || '',
    createdAt:   group.created_at,
    memberCount: adminCount + userCount,
    categories,
  }
}

function getAllFixedGroups() {
  if (getChatVisibility().hideGroups) return []
  return FIXED_GROUP_IDS.map(getFixedGroupWithCategories).filter(Boolean)
}

const chatController = {
  getVisibility(req, res, next) {
    try {
      res.json({ success: true, data: getChatVisibility() })
    } catch (err) {
      next(err)
    }
  },

  updateVisibility(req, res, next) {
    try {
      const { hidePeople, hideGroups } = req.body
      if (typeof hidePeople !== 'boolean' || typeof hideGroups !== 'boolean') {
        return res.status(400).json({ success: false, message: 'hidePeople and hideGroups must be boolean values' })
      }
      res.json({ success: true, data: setChatVisibility({ hidePeople, hideGroups }) })
    } catch (err) {
      next(err)
    }
  },

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

  // ── FIXED GROUPS ──────────────────────────────────────────────────────────

  /** GET /chat/groups — all roles see all 4 fixed groups */
  getGroupsForSuperAdmin(req, res, next) {
    try {
      res.json({ success: true, data: getAllFixedGroups() })
    } catch (err) {
      next(err)
    }
  },

  getGroupsForAdmin(req, res, next) {
    try {
      res.json({ success: true, data: getAllFixedGroups() })
    } catch (err) {
      next(err)
    }
  },

  getGroupsForUser(req, res, next) {
    try {
      res.json({ success: true, data: getAllFixedGroups() })
    } catch (err) {
      next(err)
    }
  },

  /** POST /chat/groups — REMOVED: groups are fixed, cannot be created */
  createGroupForSuperAdmin(req, res, next) {
    return res.status(403).json({ success: false, message: 'Groups are fixed and cannot be created.' })
  },

  // ── GROUP MESSAGES ────────────────────────────────────────────────────────

  getGroupMessagesForSuperAdmin(req, res, next) {
    try {
      const { groupId } = req.params
      if (!FIXED_GROUP_IDS.includes(groupId)) {
        return res.status(404).json({ success: false, message: 'Group not found' })
      }
      const rows = db.prepare(`
        SELECT id, sender_id, sender_role, message, status, created_at
        FROM chat_group_messages WHERE group_id = ? ORDER BY created_at ASC
      `).all(groupId)
      db.prepare(`UPDATE chat_group_messages SET status = 'read' WHERE group_id = ? AND status = 'sent'`).run(groupId)
      res.json({
        success: true,
        data: rows.map((msg) => ({
          id: msg.id, senderId: msg.sender_id, senderRole: msg.sender_role,
          message: msg.message, status: msg.status, createdAt: msg.created_at,
          isMine: msg.sender_id === req.superAdmin.id && msg.sender_role === 'super_admin',
        })),
      })
    } catch (err) { next(err) }
  },

  getGroupMessagesForAdmin(req, res, next) {
    try {
      const { groupId } = req.params
      if (!FIXED_GROUP_IDS.includes(groupId)) {
        return res.status(404).json({ success: false, message: 'Group not found' })
      }
      const rows = db.prepare(`
        SELECT id, sender_id, sender_role, message, status, created_at
        FROM chat_group_messages WHERE group_id = ? ORDER BY created_at ASC
      `).all(groupId)
      db.prepare(`UPDATE chat_group_messages SET status = 'read' WHERE group_id = ? AND status = 'sent'`).run(groupId)
      res.json({
        success: true,
        data: rows.map((msg) => ({
          id: msg.id, senderId: msg.sender_id, senderRole: msg.sender_role,
          message: msg.message, status: msg.status, createdAt: msg.created_at,
          isMine: msg.sender_id === req.admin.id && msg.sender_role === 'admin',
        })),
      })
    } catch (err) { next(err) }
  },

  getGroupMessagesForUser(req, res, next) {
    try {
      const { groupId } = req.params
      if (!FIXED_GROUP_IDS.includes(groupId)) {
        return res.status(404).json({ success: false, message: 'Group not found' })
      }
      const rows = db.prepare(`
        SELECT id, sender_id, sender_role, message, status, created_at
        FROM chat_group_messages WHERE group_id = ? ORDER BY created_at ASC
      `).all(groupId)
      db.prepare(`UPDATE chat_group_messages SET status = 'read' WHERE group_id = ? AND status = 'sent'`).run(groupId)
      res.json({
        success: true,
        data: rows.map((msg) => ({
          id: msg.id, senderId: msg.sender_id, senderRole: msg.sender_role,
          message: msg.message, status: msg.status, createdAt: msg.created_at,
          isMine: msg.sender_id === req.user.id && msg.sender_role === 'user',
        })),
      })
    } catch (err) { next(err) }
  },

  sendGroupMessageForSuperAdmin(req, res, next) {
    try {
      const { groupId } = req.params
      const { message } = req.body
      if (!message || !String(message).trim()) {
        return res.status(400).json({ success: false, message: 'Message text is required' })
      }
      if (!FIXED_GROUP_IDS.includes(groupId)) {
        return res.status(404).json({ success: false, message: 'Group not found' })
      }
      const row = { id: uuidv4(), group_id: groupId, sender_id: req.superAdmin.id, sender_role: 'super_admin', message: String(message).trim(), created_at: new Date().toISOString() }
      db.prepare(`INSERT INTO chat_group_messages (id, group_id, sender_id, sender_role, message, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(row.id, row.group_id, row.sender_id, row.sender_role, row.message, row.created_at)
      res.status(201).json({ success: true, data: row })
    } catch (err) { next(err) }
  },

  sendGroupMessageForAdmin(req, res, next) {
    try {
      const { groupId } = req.params
      const { message } = req.body
      if (!message || !String(message).trim()) {
        return res.status(400).json({ success: false, message: 'Message text is required' })
      }
      if (!FIXED_GROUP_IDS.includes(groupId)) {
        return res.status(404).json({ success: false, message: 'Group not found' })
      }
      const row = { id: uuidv4(), group_id: groupId, sender_id: req.admin.id, sender_role: 'admin', message: String(message).trim(), created_at: new Date().toISOString() }
      db.prepare(`INSERT INTO chat_group_messages (id, group_id, sender_id, sender_role, message, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(row.id, row.group_id, row.sender_id, row.sender_role, row.message, row.created_at)
      res.status(201).json({ success: true, data: row })
    } catch (err) { next(err) }
  },

  sendGroupMessageForUser(req, res, next) {
    try {
      const { groupId } = req.params
      const { message } = req.body
      if (!message || !String(message).trim()) {
        return res.status(400).json({ success: false, message: 'Message text is required' })
      }
      if (!FIXED_GROUP_IDS.includes(groupId)) {
        return res.status(404).json({ success: false, message: 'Group not found' })
      }
      const row = { id: uuidv4(), group_id: groupId, sender_id: req.user.id, sender_role: 'user', message: String(message).trim(), created_at: new Date().toISOString() }
      db.prepare(`INSERT INTO chat_group_messages (id, group_id, sender_id, sender_role, message, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(row.id, row.group_id, row.sender_id, row.sender_role, row.message, row.created_at)
      res.status(201).json({ success: true, data: row })
    } catch (err) { next(err) }
  },

  // ── GROUP CATEGORIES (super admin only) ───────────────────────────────────

  /** GET /chat/groups/:groupId/categories */
  getCategoriesForGroup(req, res, next) {
    try {
      const { groupId } = req.params
      if (!FIXED_GROUP_IDS.includes(groupId)) {
        return res.status(404).json({ success: false, message: 'Group not found' })
      }
      const categories = db.prepare(`
        SELECT id, group_id, name, image_url, created_by, created_at
        FROM group_categories WHERE group_id = ? ORDER BY created_at ASC
      `).all(groupId)
      res.json({ success: true, data: categories })
    } catch (err) { next(err) }
  },

  /** POST /chat/groups/:groupId/categories — super admin only, supports image upload */
  createCategoryForGroup(req, res, next) {
    try {
      const { groupId } = req.params
      const { name, image_url } = req.body
      if (!FIXED_GROUP_IDS.includes(groupId)) {
        return res.status(404).json({ success: false, message: 'Group not found' })
      }
      if (!name || !String(name).trim()) {
        return res.status(400).json({ success: false, message: 'Category name is required' })
      }
      const id = uuidv4()
      const now = new Date().toISOString()
      db.prepare(`
        INSERT INTO group_categories (id, group_id, name, image_url, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, groupId, String(name).trim(), image_url || null, req.superAdmin.id, now)
      res.status(201).json({
        success: true,
        data: { id, group_id: groupId, name: String(name).trim(), image_url: image_url || null, created_by: req.superAdmin.id, created_at: now },
      })
    } catch (err) { next(err) }
  },

  /** DELETE /chat/groups/:groupId/categories/:categoryId — super admin only */
  deleteCategoryForGroup(req, res, next) {
    try {
      const { groupId, categoryId } = req.params
      if (!FIXED_GROUP_IDS.includes(groupId)) {
        return res.status(404).json({ success: false, message: 'Group not found' })
      }
      db.prepare('DELETE FROM group_categories WHERE id = ? AND group_id = ?').run(categoryId, groupId)
      res.json({ success: true, message: 'Category deleted' })
    } catch (err) { next(err) }
  },

}

module.exports = chatController
