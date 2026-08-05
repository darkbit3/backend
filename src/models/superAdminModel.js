const db = require('../database/db')

const SuperAdminModel = {
  findByPhone(identifier) {
    return db.prepare('SELECT * FROM super_admins WHERE phone = ? OR LOWER(name) = LOWER(?)').get(identifier, identifier)
  },

  findById(id) {
    return db.prepare('SELECT id, phone, name, created_at FROM super_admins WHERE id = ?').get(id)
  },

  updatePassword(id, hashedPassword) {
    return db.prepare(`
      UPDATE super_admins SET password = ?, updated_at = datetime('now') WHERE id = ?
    `).run(hashedPassword, id)
  },
}

module.exports = SuperAdminModel
