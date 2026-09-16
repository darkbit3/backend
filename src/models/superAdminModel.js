const db = require('../database/db')

const SuperAdminModel = {
  findByPhone(identifier) {
    const admin = db.prepare('SELECT * FROM super_admins WHERE phone = ? OR name = ?').get(identifier, identifier)
    if (!admin) return null
    // Strict case-sensitive match for both phone and username/name
    if (admin.phone !== identifier && admin.name !== identifier) {
      return null
    }
    return admin
  },

  findByEmail(email) {
    return db.prepare('SELECT * FROM super_admins WHERE LOWER(email) = LOWER(?)').get(email)
  },

  findById(id) {
    return db.prepare('SELECT id, phone, email, name, created_at FROM super_admins WHERE id = ?').get(id)
  },

  updatePassword(id, hashedPassword) {
    return db.prepare(`
      UPDATE super_admins SET password = ?, updated_at = datetime('now') WHERE id = ?
    `).run(hashedPassword, id)
  },
}

module.exports = SuperAdminModel
