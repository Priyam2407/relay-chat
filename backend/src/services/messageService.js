const db = require('../db');
const { validateUsername, validateText } = require('../utils/validate');
const { historyPageSize } = require('../config');

const toDto = (r) => ({
  id: r.id,
  clientId: r.client_id,
  username: r.username,
  text: r.text,
  createdAt: r.created_at,
});

const insertStmt = db.prepare(
  'INSERT INTO messages (client_id, username, text, created_at) VALUES (?, ?, ?, ?)'
);
const byClientId = db.prepare('SELECT * FROM messages WHERE client_id = ?');
const byId = db.prepare('SELECT * FROM messages WHERE id = ?');
const latest = db.prepare('SELECT * FROM messages ORDER BY id DESC LIMIT ?');
const olderThan = db.prepare('SELECT * FROM messages WHERE id < ? ORDER BY id DESC LIMIT ?');

/** Creates a message. Idempotent on clientId, so retries never duplicate. */
function createMessage({ username, text, clientId }) {
  const user = validateUsername(username);
  const body = validateText(text);

  if (clientId) {
    const existing = byClientId.get(clientId);
    if (existing) return { message: toDto(existing), created: false };
  }
  const info = insertStmt.run(clientId || null, user, body, new Date().toISOString());
  return { message: toDto(byId.get(info.lastInsertRowid)), created: true };
}

/** Returns up to `limit` messages older than `before` (id), oldest first. */
function getHistory({ limit, before }) {
  const size = Math.min(Math.max(parseInt(limit, 10) || historyPageSize, 1), 200);
  const beforeId = parseInt(before, 10);
  const rows = beforeId ? olderThan.all(beforeId, size) : latest.all(size);
  return rows.reverse().map(toDto);
}

module.exports = { createMessage, getHistory };
