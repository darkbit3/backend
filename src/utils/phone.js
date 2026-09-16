function normalizePhone(phone) {
  const digits = String(phone || '').trim().replace(/\D/g, '')
  let local = digits

  if (local.startsWith('251')) local = local.slice(3)
  if (local.startsWith('0')) local = local.slice(1)

  if (local.length !== 9 || !['9', '7'].includes(local[0])) return null
  return '0' + local
}

function getPhoneVariants(phone) {
  const raw = String(phone || '').trim()
  const digits = raw.replace(/\D/g, '')
  let local = digits
  if (local.startsWith('251')) local = local.slice(3)
  if (local.startsWith('0')) local = local.slice(1)

  if (local.length === 9 && ['9', '7'].includes(local[0])) {
    return Array.from(new Set([
      '0' + local,
      '251' + local,
      '+251' + local,
      local,
      raw
    ]))
  }
  return [raw]
}

function phonePattern() {
  return /^(?:0[97]\d{8}|251[97]\d{8}|\+251[97]\d{8})$/
}

module.exports = { normalizePhone, getPhoneVariants, phonePattern }
