require('dotenv').config()

function requiredSecret(name) {
  const value = process.env[name]
  if (!value || value.length < 32) {
    throw new Error(`${name} must be set and at least 32 characters long`)
  }
  return value
}

function requiredValue(name) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} must be set`)
  return value
}

const defaultPostgresUrl = 'postgresql://neondb_owner:npg_R1LMbTEJ9tXH@ep-spring-art-a5lwohif-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwt: {
    secret: requiredSecret('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: requiredSecret('JWT_REFRESH_SECRET'),
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  db: {
    path: process.env.DB_PATH || './data/database.sqlite',
    url: process.env.DB_PATH
      ? process.env.DB_PATH
      : (process.env.DATABASE_URL || process.env.DB_URL || defaultPostgresUrl),
  },
  admin: {
    phone: requiredValue('ADMIN_PHONE'),
    password: requiredValue('ADMIN_PASSWORD'),
  },
}
