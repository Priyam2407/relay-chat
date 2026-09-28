const router = require('express').Router();
const { sendMessage, getMessages } = require('../controllers/messageController');

// Wraps async handlers so thrown errors reach the error middleware.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.post('/', wrap(sendMessage));
router.get('/', wrap(getMessages));

module.exports = router;
