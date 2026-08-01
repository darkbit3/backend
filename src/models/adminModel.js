const db = require('../database/db')

const AdminModel = {
  findByPhone(phone) {
    return db.prepare('SELECT * FROM admins WHERE phone = ?').get(phone)
  },

  findById(id) {
    return db.prepare('SELECT id, phone, name, created_at FROM admins WHERE id = ?').get(id)
  },

  updatePassword(id, hashedPassword) {
    return db.prepare(`
      UPDATE admins SET password = ?, updated_at = datetime('now') WHERE id = ?
    `).run(hashedPassword, id)
  },
}

module.exports = AdminModel
