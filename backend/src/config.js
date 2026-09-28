require('dotenv').config();

module.exports = {
  port: Number(process.env.PORT) || 4000,
  corsOrigin: process.env.CORS_ORIGIN || '*',
  dbPath: process.env.DB_PATH || './data/chat.db',
  maxMessageLength: 1000,
  historyPageSize: 50,
};
