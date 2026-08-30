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

test('Render defaults to SQLite unless a real Postgres URL is configured', () => {
  const prevRender = process.env.RENDER
  const prevDatabaseUrl = process.env.DATABASE_URL
  const prevDbUrl = process.env.DB_URL
  const prevPostgresUrl = process.env.POSTGRES_URL
  const prevUsePostgres = process.env.USE_POSTGRES

  process.env.RENDER = '1'
  delete process.env.DATABASE_URL
  delete process.env.DB_URL
  delete process.env.POSTGRES_URL
  delete process.env.USE_POSTGRES

  try {
    const configPath = require.resolve('../src/config/config')
    delete require.cache[configPath]
    const config = require(configPath)
    assert.ok(config.db.url.includes('database.sqlite') || config.db.url.endsWith('sqlite'))
  } finally {
    if (prevRender) process.env.RENDER = prevRender
    else delete process.env.RENDER

    if (prevDatabaseUrl) process.env.DATABASE_URL = prevDatabaseUrl
    else delete process.env.DATABASE_URL

    if (prevDbUrl) process.env.DB_URL = prevDbUrl
    else delete process.env.DB_URL

    if (prevPostgresUrl) process.env.POSTGRES_URL = prevPostgresUrl
    else delete process.env.POSTGRES_URL

    if (prevUsePostgres) process.env.USE_POSTGRES = prevUsePostgres
    else delete process.env.USE_POSTGRES
  }
})
