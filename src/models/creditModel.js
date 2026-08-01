const db = require('../database/db')
const { v4: uuid } = require('uuid')

const CreditModel = {
  // Sync any existing sales with payment_type = 'Credit' that don't have a credit row yet
  syncMissingCredits() {
    try {
      const missing = db.prepare(`
        SELECT s.* FROM sales s
        LEFT JOIN credits c ON s.id = c.sale_id
        WHERE s.payment_type = 'Credit' AND c.id IS NULL
      `).all()
      for (const s of missing) {
        CreditModel.createFromSale({
          saleId:      s.id,
          cashierId:   s.cashier_id,
          ownerId:     s.owner_id,
          customer:    s.customer,
          totalAmount: s.total_amount,
          note:        s.note,
        })
      }
    } catch (err) {
      console.error('[DB] Error syncing missing credits:', err)
    }
  },

  // Called inside a sale transaction when paymentType === 'Credit'
  createFromSale({ saleId, cashierId, ownerId, customer, totalAmount, note }) {
    const id = uuid()
    db.prepare(`
      INSERT INTO credits (id, sale_id, cashier_id, owner_id, customer, total_amount, total_paid, note)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    `).run(id, saleId, cashierId, ownerId, customer || 'Unknown', totalAmount, note || null)
    return CreditModel.findById(id)
  },

  findById(id) {
    const credit = db.prepare('SELECT * FROM credits WHERE id = ?').get(id)
    if (!credit) return null
    credit.payments = db.prepare(
      'SELECT * FROM credit_payments WHERE credit_id = ? ORDER BY paid_at ASC'
    ).all(id)
    return credit
  },

  // Cashier / User: list credits for cashier or owner
  findByCashier(userOrCashierId) {
    CreditModel.syncMissingCredits()
    const credits = db.prepare(
      'SELECT * FROM credits WHERE cashier_id = ? OR owner_id = ? ORDER BY created_at DESC'
    ).all(userOrCashierId, userOrCashierId)
    return credits.map(c => ({
      ...c,
      payments: db.prepare(
        'SELECT * FROM credit_payments WHERE credit_id = ? ORDER BY paid_at ASC'
      ).all(c.id),
    }))
  },

  // Owner: list all credits from their cashiers
  findByOwner(ownerId) {
    CreditModel.syncMissingCredits()
    const credits = db.prepare(`
      SELECT cr.*, c.name AS cashier_name
      FROM credits cr
      LEFT JOIN cashiers c ON cr.cashier_id = c.id
      WHERE cr.owner_id = ? OR cr.cashier_id = ?
      ORDER BY cr.created_at DESC
    `).all(ownerId, ownerId)
    return credits.map(c => ({
      ...c,
      payments: db.prepare(
        'SELECT * FROM credit_payments WHERE credit_id = ? ORDER BY paid_at ASC'
      ).all(c.id),
    }))
  },

  // Owner dashboard stats
  statsByOwner(ownerId) {
    CreditModel.syncMissingCredits()
    return db.prepare(`
      SELECT
        COUNT(*)                                          AS total_credits,
        COALESCE(SUM(total_amount), 0)                   AS total_amount,
        COALESCE(SUM(total_paid), 0)                     AS total_paid,
        COALESCE(SUM(total_amount - total_paid), 0)      AS total_remaining
      FROM credits
      WHERE owner_id = ? OR cashier_id = ?
    `).get(ownerId, ownerId)
  },

  // Add a payment installment
  addPayment(creditId, { amount, note }) {
    const payId = uuid()
    db.prepare(`
      INSERT INTO credit_payments (id, credit_id, amount, note)
      VALUES (?, ?, ?, ?)
    `).run(payId, creditId, amount, note || null)

    // Update total_paid on the credit row
    db.prepare(`
      UPDATE credits
      SET total_paid = total_paid + ?
      WHERE id = ?
    `).run(amount, creditId)

    return CreditModel.findById(creditId)
  },
}

module.exports = CreditModel
