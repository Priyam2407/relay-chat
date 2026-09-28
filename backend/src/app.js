const path = require('path');
const express = require('express');
const cors = require('cors');
const config = require('./config');
const messageRoutes = require('./routes/messages');
const receiptRoutes = require('./routes/receipts');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',') }));
app.use(express.json({ limit: '10kb' }));

app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/messages', messageRoutes);
app.use('/api/receipts', receiptRoutes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
