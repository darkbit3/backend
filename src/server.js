require('dotenv').config()
const express      = require('express')
const cors         = require('cors')
const helmet       = require('helmet')
const morgan       = require('morgan')
const rateLimit    = require('express-rate-limit')
const config       = require('./config/config')
const { createTables } = require('./database/schema')
const { seedAdmin, seedSuperAdmin }  = require('./database/init')
const errorHandler = require('./middleware/errorHandler')
const authRoutes            = require('./routes/admin_login_route')
const userRoutes            = require('./routes/admin_manage_route')
const userAuthRoutes        = require('./routes/user_login_route')
const cashierRoutes         = require('./routes/cashier_route')
const saleRoutes            = require('./routes/sale_route')
const materialRoutes        = require('./routes/material_route')
const creditRoutes          = require('./routes/credit_route')
const superAuthRoutes       = require('./routes/super_admin_login_route')
const superManageRoutes     = require('./routes/super_admin_manage_route')
const cutterRoutes          = require('./routes/cutter_route')
const chatRoutes            = require('./routes/chat_route')

const app = express()

// ── Security middleware ────────────────────────────────────────────────────
app.use(helmet())
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return callback(null, true)
    }
    const allowed = [
      'http://localhost:5173',
      'http://localhost:4173',
      'http://localhost:5174',
      'http://localhost:4174',
      'https://admin-m1b6.onrender.com',
      'https://admin-tafd.onrender.com',
      'https://super-admin-y9sz.onrender.com',
    ]
    if (allowed.includes(origin)) return callback(null, true)
    return callback(new Error(`CORS blocked: ${origin}`))
  },
  credentials: true,
}
app.use(cors(corsOptions))
app.options('*', cors(corsOptions))

// ── Rate limiting ──────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { success: false, message: 'Too many requests, please try again later.' },
})
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts, please try again later.' },
})
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
})

app.use('/api/auth/login',        authLimiter)
app.use('/api/user-auth/login',   authLimiter)
app.use('/api/super-auth/login',  authLimiter)
app.use('/api/chat',              chatLimiter)
app.use(limiter)

// ── Body parsing ───────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: false, limit: '10mb' }))

// ── Logging ────────────────────────────────────────────────────────────────
if (config.nodeEnv !== 'test') {
  app.use(morgan('dev'))
}

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth',        authRoutes)
app.use('/api/users',       userRoutes)
app.use('/api/user-auth',   userAuthRoutes)
app.use('/api/cashiers',    cashierRoutes)
app.use('/api/sales',       saleRoutes)
app.use('/api/materials',   materialRoutes)
app.use('/api/credits',     creditRoutes)
app.use('/api/super-auth',   superAuthRoutes)
app.use('/api/super/admins', superManageRoutes)
app.use('/api/cutters',      cutterRoutes)
app.use('/api/chat',         chatRoutes)

// ── Root ───────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ success: true, message: 'Shmeta API is running', version: '1.0.0' })
})

// ── Health check ───────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ success: true, message: 'Server is running', env: config.nodeEnv })
})
// Also respond on /api/health (used by front-end warm-up pings)
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Server is running', env: config.nodeEnv })
})

// ── Temp debug: verify admin password (remove after fix) ──────────────────
app.get('/debug-admin', async (req, res) => {
  const bcrypt = require('bcryptjs')
  const db = require('./database/db')
  const admin = db.prepare('SELECT phone, name, password FROM admins LIMIT 1').get()
  if (!admin) return res.json({ exists: false })
  const match = await bcrypt.compare(config.admin.password, admin.password)
  res.json({
    exists: true,
    phone: admin.phone,
    name: admin.name,
    configPassword: config.admin.password,
    passwordMatch: match,
  })
})

// ── 404 handler ────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` })
})

// ── Error handler ──────────────────────────────────────────────────────────
app.use(errorHandler)

// ── Boot: init DB then start listening ────────────────────────────────────
async function start() {
  createTables()
  await seedAdmin()
  await seedSuperAdmin()
  return new Promise((resolve) => {
    const server = app.listen(config.port, () => {
      console.log(`[SERVER] Running on http://localhost:${config.port} (${config.nodeEnv})`)
      resolve(server)
    })
  })
}

if (require.main === module) {
  start().catch((err) => {
    console.error('[SERVER] Failed to start:', err)
    process.exit(1)
  })
}

module.exports = app
