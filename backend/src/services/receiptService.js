const db = require('../db');

const maxMessageId = db.prepare('SELECT COALESCE(MAX(id), 0) AS m FROM messages');
const upsert = db.prepare(`
  INSERT INTO receipts (username, delivered_id, read_id) VALUES (@username, @delivered, @read)
  ON CONFLICT(username) DO UPDATE SET
    delivered_id = MAX(delivered_id, excluded.delivered_id),
    read_id      = MAX(read_id, excluded.read_id)
`);
const byUser = db.prepare('SELECT * FROM receipts WHERE username = ?');
const all = db.prepare('SELECT * FROM receipts');

const toDto = (r) => ({ username: r.username, delivered: r.delivered_id, read: r.read_id });

// Accepts only sane integers, never above the newest real message id.
const clean = (v, ceiling) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, ceiling) : 0;
};

/** Records progress for a user. Values only ever move forward. Reading implies delivered. */
function updateReceipt(username, { delivered, read } = {}) {
  const ceiling = maxMessageId.get().m;
  const r = clean(read, ceiling);
  const d = Math.max(clean(delivered, ceiling), r);
  upsert.run({ username, delivered: d, read: r });
  return toDto(byUser.get(username));
}

const getReceipts = () => all.all().map(toDto);

module.exports = { updateReceipt, getReceipts };
