const db   = require('../database/db')
const { v4: uuid } = require('uuid')
// lazy-require to avoid circular dependency
const getCreditModel = () => require('./creditModel')

const SaleModel = {
  create({ cashierId, ownerId, customer, paymentType, totalAmount, note, items }) {
    const id = uuid()

    const run = db.transaction(() => {
      db.prepare(`
        INSERT INTO sales (id, cashier_id, owner_id, customer, payment_type, total_amount, note)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(id, cashierId, ownerId, customer || null, paymentType, totalAmount, note || null)

      const insertItem = db.prepare(`
        INSERT INTO sale_items (id, sale_id, material, quantity, unit_price, total)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      const updateStock = db.prepare(`
        UPDATE materials
        SET quantity = MAX(0, quantity - ?)
        WHERE user_id = ? AND (LOWER(name) = LOWER(?) OR id = ?)
      `)

      for (const item of items) {
        insertItem.run(uuid(), id, item.material, item.quantity, item.unitPrice, item.total)
        updateStock.run(item.quantity, ownerId, item.material, item.material)
      }

      // Auto-create credit record for credit sales
      if (paymentType === 'Credit') {
        getCreditModel().createFromSale({
          saleId:      id,
          cashierId,
          ownerId,
          customer,
          totalAmount,
          note,
        })
      }
    })
    run()

    return SaleModel.findById(id)
  },


  findById(id) {
    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id)
    if (!sale) return null
    sale.items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id)
    return sale
  },

  findByCashier(cashierId, { limit = 50, offset = 0 } = {}) {
    const sales = db.prepare(
      'SELECT * FROM sales WHERE cashier_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).all(cashierId, limit, offset)
    return sales.map(s => ({
      ...s,
      items: db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(s.id),
    }))
  },

  findByOwner(ownerId, { limit = 200, offset = 0 } = {}) {
    const sales = db.prepare(
      'SELECT s.*, c.name AS cashier_name FROM sales s JOIN cashiers c ON s.cashier_id = c.id WHERE s.owner_id = ? ORDER BY s.created_at DESC LIMIT ? OFFSET ?'
    ).all(ownerId, limit, offset)
    return sales.map(s => ({
      ...s,
      items: db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(s.id),
    }))
  },

  statsByCashier(cashierId) {
    const row = db.prepare(`
      SELECT
        COUNT(*)                                       AS total_sales,
        COALESCE(SUM(total_amount), 0)                 AS total_revenue,
        COALESCE(SUM(CASE WHEN payment_type = 'Credit' THEN total_amount ELSE 0 END), 0) AS total_credit,
        COALESCE(SUM(CASE WHEN payment_type = 'Cash'   THEN total_amount ELSE 0 END), 0) AS total_cash
      FROM sales WHERE cashier_id = ?
    `).get(cashierId)
    return row
  },

  statsForOwner(ownerId) {
    return db.prepare(`
      SELECT
        COUNT(*)                                       AS total_sales,
        COALESCE(SUM(total_amount), 0)                 AS total_revenue,
        COALESCE(SUM(CASE WHEN payment_type = 'Credit' THEN total_amount ELSE 0 END), 0) AS total_credit,
        COALESCE(SUM(CASE WHEN payment_type = 'Cash'   THEN total_amount ELSE 0 END), 0) AS total_cash
      FROM sales WHERE owner_id = ?
    `).get(ownerId)
  },
}

module.exports = SaleModel
