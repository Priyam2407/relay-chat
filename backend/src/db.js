const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('./config');

fs.mkdirSync(path.dirname(path.resolve(config.dbPath)), { recursive: true });

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id  TEXT UNIQUE,
    username   TEXT NOT NULL,
    text       TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  -- Highest message id each user has received / read.
  CREATE TABLE IF NOT EXISTS receipts (
    username     TEXT PRIMARY KEY,
    delivered_id INTEGER NOT NULL DEFAULT 0,
    read_id      INTEGER NOT NULL DEFAULT 0
  );
`);

module.exports = db;
