require('dotenv').config()
const express      = require('express')
const cors         = require('cors')
const helmet       = require('helmet')
const morgan       = require('morgan')
const rateLimit    = require('express-rate-limit')
const config       = require('./config/config')
const { createTables } = require('./database/schema')
const errorHandler = require('./middleware/errorHandler')
const authRoutes     = require('./routes/admin_login_route')
const userRoutes     = require('./routes/admin_manage_route')
const userAuthRoutes = require('./routes/user_login_route')
const cashierRoutes  = require('./routes/cashier_route')
const saleRoutes     = require('./routes/sale_route')
const materialRoutes = require('./routes/material_route')
const creditRoutes   = require('./routes/credit_route')

const app = express()

// ── Init DB ────────────────────────────────────────────────────────────────
createTables()

// ── Security middleware ────────────────────────────────────────────────────
app.use(helmet())
// Allow all origins in development (Flutter desktop/mobile sends no Origin header)
app.use(cors({
  origin: config.nodeEnv === 'production'
    ? ['http://localhost:5173', 'http://localhost:4173']
   : ['http://localhost:5173', 'http://localhost:4173', 'https://admin-m1b6.onrender.com'],
  credentials: true,
}))

// ── Rate limiting ──────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { success: false, message: 'Too many requests, please try again later.' },
})
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts, please try again later.' },
})

app.use('/api/auth/login',      authLimiter)
app.use('/api/user-auth/login', authLimiter)
app.use(limiter)

// ── Body parsing ───────────────────────────────────────────────────────────
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

// ── Logging ────────────────────────────────────────────────────────────────
if (config.nodeEnv !== 'test') {
  app.use(morgan('dev'))
}

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth',      authRoutes)
app.use('/api/users',     userRoutes)
app.use('/api/user-auth', userAuthRoutes)
app.use('/api/cashiers',  cashierRoutes)
app.use('/api/sales',     saleRoutes)
app.use('/api/materials', materialRoutes)
app.use('/api/credits',   creditRoutes)

// ── Health check ───────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ success: true, message: 'Server is running', env: config.nodeEnv })
})

// ── 404 handler ────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` })
})

// ── Error handler ──────────────────────────────────────────────────────────
app.use(errorHandler)

// ── Start ──────────────────────────────────────────────────────────────────
app.listen(config.port, () => {
  console.log(`[SERVER] Running on http://localhost:${config.port} (${config.nodeEnv})`)
})

module.exports = app
