const Database = require('better-sqlite3')
const path     = require('path')
const config   = require('../config/config')

const dbPath = path.resolve(__dirname, '../../', config.db.path)
const db     = new Database(dbPath)

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

module.exports = db
