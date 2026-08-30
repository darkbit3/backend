const { test } = require('node:test')
const assert = require('node:assert/strict')

process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-access-secret-that-is-at-least-32-characters-long'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-that-is-at-least-32-characters-long'
process.env.ADMIN_PHONE = '0900000000'
process.env.ADMIN_PASSWORD = 'test-admin-password'
process.env.SUPER_ADMIN_PHONE = '0900000001'
process.env.SUPER_ADMIN_PASSWORD = 'test-super-password'
process.env.SUPER_ADMIN_NAME = 'Test Super Admin'
process.env.DB_PATH = './data/startup-test.sqlite'

const { seedSuperAdmin } = require('../src/database/init')

test('seedSuperAdmin skips when super-admin env settings are missing', async () => {
  const prevPhone = process.env.SUPER_ADMIN_PHONE
  const prevPassword = process.env.SUPER_ADMIN_PASSWORD
  const prevName = process.env.SUPER_ADMIN_NAME

  delete process.env.SUPER_ADMIN_PHONE
  delete process.env.SUPER_ADMIN_PASSWORD
  delete process.env.SUPER_ADMIN_NAME

  try {
    await assert.doesNotReject(async () => {
      await seedSuperAdmin()
    })
  } finally {
    if (prevPhone) process.env.SUPER_ADMIN_PHONE = prevPhone
    if (prevPassword) process.env.SUPER_ADMIN_PASSWORD = prevPassword
    if (prevName) process.env.SUPER_ADMIN_NAME = prevName
  }
})
