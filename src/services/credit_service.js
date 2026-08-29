const { v4: uuidv4 } = require('uuid')
const CreditModel = require('../models/creditModel')

const creditService = {
  // Cashier: list own credit sales
  listByCashier(cashierId) {
    return CreditModel.findByCashier(cashierId)
  },

  // Owner: list all credits from their cashiers
  listByOwner(ownerId) {
    return CreditModel.findByOwner(ownerId)
  },

  // Owner dashboard: summary stats
  statsByOwner(ownerId) {
    return CreditModel.statsByOwner(ownerId)
  },

  // Add payment installment to a credit
  addPayment(creditId, userId, { amount, note }) {
    const credit = CreditModel.findById(creditId)
    if (!credit) throw { status: 404, message: 'Credit not found' }

    // Only owner or cashier who created it may add payment
    if (credit.owner_id !== userId && credit.cashier_id !== userId) {
      throw { status: 403, message: 'Access denied' }
    }

    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) {
      throw { status: 400, message: 'Amount must be a positive number' }
    }

    const remaining = credit.total_amount - credit.total_paid
    if (amt > remaining + 0.01) {
      throw { status: 400, message: `Amount exceeds remaining balance (${remaining.toFixed(2)} ETB)` }
    }

    return CreditModel.addPayment(creditId, { amount: amt, note })
  },

  // Record credit issued by owner/admin (not from a sale)
  recordCredit(user, { customer, amount, note }) {
    if (!user || !user.id) throw { status: 401, message: 'Unauthorized' }

    // Only owners/manufacturers/resellers and admins can issue credit
    const role = user.role
    if (!['Manufacturer', 'Reseller', 'Admin'].includes(role)) {
      throw { status: 403, message: 'Only owners and admins can issue credit' }
    }

    if (!customer || customer.trim().length === 0) {
      throw { status: 400, message: 'Customer name is required' }
    }

    const amt = parseFloat(amount)
    if (isNaN(amt) || amt <= 0) {
      throw { status: 400, message: 'Amount must be a positive number' }
    }

    const id = uuidv4()
    const ownerId = role === 'Admin' ? null : user.id
    const issuedBy = role === 'Admin' ? 'admin' : 'owner'

    const data = {
      id,
      sale_id: null,
      cashier_id: null,
      owner_id: ownerId,
      customer: customer.trim(),
      total_amount: amt,
      total_paid: 0,
      issued_by: issuedBy,
      note: note || null,
    }

    return CreditModel.create(data)
  },
}

module.exports = creditService
