const { getReceipts } = require('../services/receiptService');

async function listReceipts(req, res) {
  res.json({ receipts: getReceipts() });
}

module.exports = { listReceipts };
