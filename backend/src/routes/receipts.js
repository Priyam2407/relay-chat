const router = require('express').Router();
const { listReceipts } = require('../controllers/receiptController');

router.get('/', (req, res, next) => listReceipts(req, res).catch(next));

module.exports = router;
