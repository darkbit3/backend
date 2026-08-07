const db = require('../database/db')

const AdminManageModel = {
  findAll() {
    return db.prepare(`
      SELECT id, phone, name, status, created_at, updated_at
      FROM admins
      ORDER BY created_at DESC
    `).all()
  },

  findById(id) {
    return db.prepare(`
      SELECT id, phone, name, status, created_at, updated_at
      FROM admins WHERE id = ?
    `).get(id)
  },

  findByIdWithPassword(id) {
    return db.prepare('SELECT * FROM admins WHERE id = ?').get(id)
  },

  findByPhone(phone) {
    return db.prepare('SELECT id FROM admins WHERE phone = ?').get(phone)
  },

  create({ id, name, phone, password, plainPassword }) {
    return db.prepare(`
      INSERT INTO admins (id, name, phone, password, plain_password, status)
      VALUES (?, ?, ?, ?, ?, 'Active')
    `).run(id, name, phone, password, plainPassword)
  },

  update(id, { name, phone }) {
    return db.prepare(`
      UPDATE admins SET name = ?, phone = ?, updated_at = datetime('now') WHERE id = ?
    `).run(name, phone, id)
  },

  delete(id) {
    return db.prepare('DELETE FROM admins WHERE id = ?').run(id)
  },

  updateStatus(id, status) {
    return db.prepare(`
      UPDATE admins SET status = ?, updated_at = datetime('now') WHERE id = ?
    `).run(status, id)
  },

  updatePassword(id, hashedPassword, plainPassword) {
    return db.prepare(`
      UPDATE admins SET password = ?, plain_password = ?, updated_at = datetime('now') WHERE id = ?
    `).run(hashedPassword, plainPassword, id)
  },

  bulkDelete(ids) {
    const del = db.prepare('DELETE FROM admins WHERE id = ?')
    const tx  = db.transaction((list) => list.forEach(id => del.run(id)))
    tx(ids)
  },

  bulkUpdateStatus(ids, status) {
    const upd = db.prepare(`UPDATE admins SET status = ?, updated_at = datetime('now') WHERE id = ?`)
    const tx  = db.transaction((list) => list.forEach(id => upd.run(status, id)))
    tx(ids)
  },

  bulkUpdatePassword(ids, hashedPassword, plainPassword) {
    const upd = db.prepare(`UPDATE admins SET password = ?, plain_password = ?, updated_at = datetime('now') WHERE id = ?`)
    const tx  = db.transaction((list) => list.forEach(id => upd.run(hashedPassword, plainPassword, id)))
    tx(ids)
  },

  getStats() {
    const total      = db.prepare('SELECT COUNT(*) AS count FROM admins').get().count
    const active     = db.prepare("SELECT COUNT(*) AS count FROM admins WHERE status = 'Active'").get().count
    const inactive   = db.prepare("SELECT COUNT(*) AS count FROM admins WHERE status = 'Inactive'").get().count

    const totalOwners        = db.prepare('SELECT COUNT(*) AS count FROM users').get().count
    const totalManufacturers = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'Manufacturer'").get().count
    const totalResellers     = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'Reseller'").get().count
    const totalCashiers      = db.prepare('SELECT COUNT(*) AS count FROM cashiers').get().count
    const totalCutters       = db.prepare('SELECT COUNT(*) AS count FROM cutters').get().count

    const ownersBreakdown = db.prepare(`
      SELECT 
        u.id, 
        u.name, 
        u.phone, 
        u.role, 
        u.status,
        (SELECT COUNT(*) FROM cashiers c WHERE c.owner_id = u.id) AS cashier_count,
        (SELECT COUNT(*) FROM cutters ct WHERE ct.owner_id = u.id) AS cutter_count
      FROM users u
      ORDER BY u.created_at DESC
    `).all()

    const adminsBreakdown = db.prepare(`
      SELECT
        a.id,
        a.name,
        a.phone,
        a.status,
        a.created_at,
        (SELECT COUNT(*) FROM users u WHERE u.admin_id = a.id) AS owner_count,
        (SELECT COUNT(*) FROM users u WHERE u.admin_id = a.id AND u.role = 'Manufacturer') AS manufacturer_count,
        (SELECT COUNT(*) FROM users u WHERE u.admin_id = a.id AND u.role = 'Reseller') AS reseller_count,
        (SELECT COUNT(*) FROM cashiers c
          WHERE c.owner_id IN (SELECT id FROM users WHERE admin_id = a.id)) AS cashier_count,
        (SELECT COUNT(*) FROM cutters ct
          WHERE ct.owner_id IN (SELECT id FROM users WHERE admin_id = a.id)) AS cutter_count
      FROM admins a
      ORDER BY a.created_at DESC
    `).all()

    return {
      total,
      active,
      inactive,
      totalOwners,
      totalManufacturers,
      totalResellers,
      totalCashiers,
      totalCutters,
      ownersBreakdown,
      adminsBreakdown,
    }
  },
}

module.exports = AdminManageModel
