function normalizePhone(phone) {
  const digits = String(phone || '').trim().replace(/\D/g, '')
  let local = digits

  if (local.startsWith('251')) local = local.slice(3)
  if (local.startsWith('0')) local = local.slice(1)

  if (local.length !== 9 || !['9', '7'].includes(local[0])) return null
  return '0' + local
}

function phonePattern() {
  return /^(?:0[97]\d{8}|251[97]\d{8}|\+251[97]\d{8})$/
}

module.exports = { normalizePhone, phonePattern }
