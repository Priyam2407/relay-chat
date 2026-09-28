const { createMessage } = require('../services/messageService');
const { updateReceipt } = require('../services/receiptService');
const { validateUsername } = require('../utils/validate');

module.exports = function registerSockets(io) {
  // username -> number of open sockets (a user can have several tabs/devices)
  const online = new Map();
  const broadcastPresence = () => io.emit('presence:update', [...online.keys()].sort());

  // Dummy auth: the client sends a username in the handshake.
  io.use((socket, next) => {
    try {
      socket.data.username = validateUsername(socket.handshake.auth?.username);
      next();
    } catch (err) {
      next(new Error(err.message));
    }
  });

  io.on('connection', (socket) => {
    const { username } = socket.data;
    online.set(username, (online.get(username) || 0) + 1);
    broadcastPresence();
    console.log(`+ ${username} connected (${socket.id})`);

    socket.on('message:send', (payload, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      try {
        const { message } = createMessage({ ...payload, username }); // never trust a client-sent username
        io.emit('message:new', message);
        reply({ ok: true, message });
      } catch (err) {
        reply({ ok: false, error: err.status ? err.message : 'Could not send message.' });
        if (!err.status) console.error(err);
      }
    });

    // Delivered / read receipts: client reports the highest message id it has received / seen.
    socket.on('receipt:update', (payload) => {
      try {
        io.emit('receipts:update', updateReceipt(username, payload));
      } catch (err) {
        console.error('receipt error:', err.message);
      }
    });

    socket.on('typing', (isTyping) => {
      socket.broadcast.emit('typing:update', { username, isTyping: Boolean(isTyping) });
    });

    socket.on('error', (err) => console.error(`socket error (${username}):`, err.message));

    socket.on('disconnect', (reason) => {
      const left = (online.get(username) || 1) - 1;
      if (left <= 0) online.delete(username);
      else online.set(username, left);
      socket.broadcast.emit('typing:update', { username, isTyping: false });
      broadcastPresence();
      console.log(`- ${username} disconnected (${reason})`);
    });
  });
};
