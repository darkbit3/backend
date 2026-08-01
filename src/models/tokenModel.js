const db = require('../database/db')

const TokenModel = {
  save({ id, token, adminId, expiresAt }) {
    return db.prepare(`
      INSERT INTO refresh_tokens (id, token, admin_id, expires_at) VALUES (?, ?, ?, ?)
    `).run(id, token, adminId, expiresAt)
  },

  findByToken(token) {
    return db.prepare('SELECT * FROM refresh_tokens WHERE token = ?').get(token)
  },

  delete(token) {
    return db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(token)
  },

  deleteAllForAdmin(adminId) {
    return db.prepare('DELETE FROM refresh_tokens WHERE admin_id = ?').run(adminId)
  },

  deleteExpired() {
    return db.prepare("DELETE FROM refresh_tokens WHERE expires_at < datetime('now')").run()
  },
}

module.exports = TokenModel
