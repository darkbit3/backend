const db = require('../database/db')

const SuperAdminModel = {
  findByPhone(identifier) {
    if (!identifier) return null
    const str = String(identifier).trim()

    // If identifier is a phone number (e.g. 9 digits starting with 9/7, or with 0, 251, +251)
    const digitsOnly = str.replace(/\D/g, '')
    let phoneVariants = []

    if (!/[a-zA-Z]/.test(str) && digitsOnly.length >= 7) {
      let raw9 = digitsOnly
      if (raw9.startsWith('251')) raw9 = raw9.slice(3)
      if (raw9.startsWith('0')) raw9 = raw9.slice(1)

      if (raw9.length === 9 && (raw9[0] === '9' || raw9[0] === '7')) {
        phoneVariants = [
          '0' + raw9,
          '251' + raw9,
          '+251' + raw9,
          raw9,
        ]
      } else {
        phoneVariants = [str, digitsOnly]
      }
    } else {
      phoneVariants = [str]
    }

    // Try finding by any phone variant
    for (const variant of phoneVariants) {
      const admin = db.prepare('SELECT * FROM super_admins WHERE phone = ?').get(variant)
      if (admin) return admin
    }

    // Try finding by exact name (strict case-sensitive)
    const adminByName = db.prepare('SELECT * FROM super_admins WHERE name = ?').get(str)
    if (adminByName && adminByName.name === str) {
      return adminByName
    }

    return null
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
