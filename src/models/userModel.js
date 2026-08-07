const db = require('../database/db')

const UserModel = {
  findAll(adminId) {
    return db.prepare(
      'SELECT id, name, phone, role, account_type, free_until, status, created_at FROM users WHERE admin_id = ? ORDER BY created_at DESC'
    ).all(adminId)
  },

  getStats(adminId) {
    const total        = db.prepare('SELECT COUNT(*) as count FROM users WHERE admin_id = ?').get(adminId).count
    const active       = db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'Active' AND admin_id = ?").get(adminId).count
    const inactive     = db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'Inactive' AND admin_id = ?").get(adminId).count
    const manufacturer = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'Manufacturer' AND admin_id = ?").get(adminId).count
    const reseller     = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'Reseller' AND admin_id = ?").get(adminId).count
    const free         = db.prepare("SELECT COUNT(*) as count FROM users WHERE (account_type = 'Free' OR account_type IS NULL) AND admin_id = ?").get(adminId).count
    const paid         = db.prepare("SELECT COUNT(*) as count FROM users WHERE account_type = 'Paid' AND admin_id = ?").get(adminId).count

    const ownersBreakdown = db.prepare(`
      SELECT
        u.id,
        u.name,
        u.phone,
        u.role,
        u.status,
        u.account_type,
        (SELECT COUNT(*) FROM cashiers c WHERE c.owner_id = u.id) AS cashier_count,
        (SELECT COUNT(*) FROM cutters  ct WHERE ct.owner_id = u.id) AS cutter_count
      FROM users u
      WHERE u.admin_id = ?
      ORDER BY u.created_at DESC
    `).all(adminId)

    return { total, active, inactive, manufacturer, reseller, free, paid, ownersBreakdown }
  },

  findById(id) {
    return db.prepare('SELECT id, name, phone, role, account_type, free_until, status, created_at, admin_id FROM users WHERE id = ?').get(id)
  },

  findByIdWithPassword(id) {
    return db.prepare('SELECT id, plain_password FROM users WHERE id = ?').get(id)
  },

  findByPhone(phone) {
    return db.prepare('SELECT * FROM users WHERE phone = ?').get(phone)
  },

  create({ id, name, phone, password, plainPassword, role, accountType, freeUntil, adminId }) {
    const type  = accountType === 'Paid' ? 'Paid' : 'Free'
    const until = (type === 'Free' && freeUntil) ? freeUntil : null
    return db.prepare(`
      INSERT INTO users (id, name, phone, password, plain_password, role, account_type, free_until, status, admin_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?)
    `).run(id, name, phone, password, plainPassword, role, type, until, adminId)
  },

  update(id, { name, phone, role, accountType, freeUntil }) {
    const type  = accountType === 'Paid' ? 'Paid' : 'Free'
    const until = (type === 'Free' && freeUntil) ? freeUntil : null
    return db.prepare(`
      UPDATE users SET name = ?, phone = ?, role = ?, account_type = ?, free_until = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(name, phone, role, type, until, id)
  },

  updateStatus(id, status) {
    return db.prepare(`
      UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?
    `).run(status, id)
  },

  updatePassword(id, hashedPassword, plainPassword) {
    return db.prepare(`
      UPDATE users SET password = ?, plain_password = ?, updated_at = datetime('now') WHERE id = ?
    `).run(hashedPassword, plainPassword, id)
  },

  delete(id) {
    return db.prepare('DELETE FROM users WHERE id = ?').run(id)
  },

  // Bulk operations
  bulkUpdateStatus(ids, status) {
    const update = db.prepare(`UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?`)
    const runAll = db.transaction((list) => list.forEach(id => update.run(status, id)))
    runAll(ids)
  },

  bulkUpdatePassword(ids, hashedPassword, plainPassword) {
    const update = db.prepare(`UPDATE users SET password = ?, plain_password = ?, updated_at = datetime('now') WHERE id = ?`)
    const runAll = db.transaction((list) => list.forEach(id => update.run(hashedPassword, plainPassword, id)))
    runAll(ids)
  },

  bulkDelete(ids) {
    const del    = db.prepare('DELETE FROM users WHERE id = ?')
    const runAll = db.transaction((list) => list.forEach(id => del.run(id)))
    runAll(ids)
  },
}

module.exports = UserModel
