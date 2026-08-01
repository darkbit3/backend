require('dotenv').config()

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  db: {
    path: process.env.DB_PATH || './data/database.sqlite',
  },
  admin: {
    phone: process.env.ADMIN_PHONE || '0912345678',
    password: process.env.ADMIN_PASSWORD || 'admin123',
  },
}
