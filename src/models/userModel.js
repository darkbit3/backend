const db = require('../database/db')

const UserModel = {
  findAll() {
    return db.prepare('SELECT id, name, phone, role, account_type, free_until, status, created_at FROM users ORDER BY created_at DESC').all()
  },

  getStats() {
    const total        = db.prepare('SELECT COUNT(*) as count FROM users').get().count
    const active       = db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'Active'").get().count
    const inactive     = db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'Inactive'").get().count
    const manufacturer = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'Manufacturer'").get().count
    const reseller     = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'Reseller'").get().count
    const free         = db.prepare("SELECT COUNT(*) as count FROM users WHERE account_type = 'Free' OR account_type IS NULL").get().count
    const paid         = db.prepare("SELECT COUNT(*) as count FROM users WHERE account_type = 'Paid'").get().count
    return { total, active, inactive, manufacturer, reseller, free, paid }
  },

  findById(id) {
    return db.prepare('SELECT id, name, phone, role, account_type, free_until, status, created_at FROM users WHERE id = ?').get(id)
  },

  findByIdWithPassword(id) {
    return db.prepare('SELECT id, plain_password FROM users WHERE id = ?').get(id)
  },

  findByPhone(phone) {
    return db.prepare('SELECT * FROM users WHERE phone = ?').get(phone)
  },

  create({ id, name, phone, password, plainPassword, role, accountType, freeUntil }) {
    const type = accountType === 'Paid' ? 'Paid' : 'Free'
    const until = (type === 'Free' && freeUntil) ? freeUntil : null
    return db.prepare(`
      INSERT INTO users (id, name, phone, password, plain_password, role, account_type, free_until, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active')
    `).run(id, name, phone, password, plainPassword, role, type, until)
  },

  update(id, { name, phone, role, accountType, freeUntil }) {
    const type = accountType === 'Paid' ? 'Paid' : 'Free'
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
    const del   = db.prepare('DELETE FROM users WHERE id = ?')
    const runAll = db.transaction((list) => list.forEach(id => del.run(id)))
    runAll(ids)
  },
}

module.exports = UserModel
