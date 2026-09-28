const service = require('../services/messageService');

async function sendMessage(req, res) {
  const { message, created } = service.createMessage(req.body || {});
  // Broadcast so REST-sent messages also reach socket clients in real time.
  if (created) req.app.get('io').emit('message:new', message);
  res.status(created ? 201 : 200).json({ message });
}

async function getMessages(req, res) {
  res.json({ messages: service.getHistory(req.query) });
}

module.exports = { sendMessage, getMessages };
