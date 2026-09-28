import { io } from 'socket.io-client';
import { API_URL } from '../config';

export const createSocket = (username) =>
  io(API_URL, {
    auth: { username },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });
