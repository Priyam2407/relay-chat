const http = require('http');
const { Server } = require('socket.io');
const config = require('./config');
const app = require('./app');
const registerSockets = require('./sockets');

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',') },
});

app.set('io', io);
registerSockets(io);

server.listen(config.port, () => console.log(`Server listening on :${config.port}`));

const shutdown = () => io.close(() => server.close(() => process.exit(0)));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
