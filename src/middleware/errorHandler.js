function errorHandler(err, req, res, next) {
  // Handle plain thrown objects like { status: 401, message: '...' }
  const status  = err.status || err.statusCode || 500
  const message = err.message || 'Internal server error'

  if (process.env.NODE_ENV === 'development') {
    console.error('[ERROR]', status, message)
  }

  res.status(status).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && err.stack ? { stack: err.stack } : {}),
  })
}

module.exports = errorHandler
