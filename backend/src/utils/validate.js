const { AppError } = require('./errors');
const { maxMessageLength } = require('../config');

const USERNAME_RE = /^[a-zA-Z0-9_]{2,20}$/;

function validateUsername(username) {
  if (typeof username !== 'string' || !USERNAME_RE.test(username.trim())) {
    throw new AppError('Username must be 2-20 letters, numbers or underscores.');
  }
  return username.trim();
}

function validateText(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new AppError('Message cannot be empty.');
  }
  if (text.length > maxMessageLength) {
    throw new AppError(`Message is too long (max ${maxMessageLength} characters).`);
  }
  return text.trim();
}

module.exports = { validateUsername, validateText };
