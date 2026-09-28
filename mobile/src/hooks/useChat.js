import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { fetchHistory, fetchReceipts, postMessage } from '../api/client';
import { createSocket } from '../socket/socket';

const makeClientId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

// Adds or replaces a message, matching on server id or clientId so
// optimistic messages and their server copies never show twice.
function upsert(list, msg) {
  const i = list.findIndex(
    (m) => (msg.id && m.id === msg.id) || (msg.clientId && m.clientId === msg.clientId)
  );
  if (i === -1) return [...list, msg];
  const next = list.slice();
  next[i] = { ...next[i], ...msg, status: 'sent' };
  return next;
}

export default function useChat(username) {
  const [messages, setMessages] = useState([]);
  const [online, setOnline] = useState([]);
  const [typing, setTyping] = useState([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [receipts, setReceipts] = useState({});
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const reported = useRef({ delivered: 0, read: 0 });
  const socketRef = useRef(null);
  const typingTimer = useRef(null);

  const loadHistory = useCallback(async () => {
    try {
      const history = await fetchHistory();
      fetchReceipts()
        .then((list) => setReceipts(Object.fromEntries(list.map((r) => [r.username, r]))))
        .catch(() => {}); // ticks are optional
      setMessages((prev) => {
        // keep unsent local messages, replace everything else with server truth
        const pending = prev.filter((m) => m.status && m.status !== 'sent');
        return pending.reduce(upsert, history);
      });
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
    const socket = createSocket(username);
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      loadHistory(); // catch up on anything missed while offline
    });
    socket.on('disconnect', () => {
      setConnected(false);
      setTyping([]);
    });
    socket.on('connect_error', (e) => {
      setConnected(false);
      setError(e.message || 'Connection failed.');
    });
    socket.on('message:new', (msg) => setMessages((prev) => upsert(prev, msg)));
    socket.on('presence:update', setOnline);
    socket.on('receipts:update', (r) => setReceipts((prev) => ({ ...prev, [r.username]: r })));
    socket.on('typing:update', ({ username: who, isTyping }) =>
      setTyping((prev) => {
        const rest = prev.filter((u) => u !== who);
        return isTyping ? [...rest, who] : rest;
      })
    );

    return () => {
      clearTimeout(typingTimer.current);
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [username, loadHistory]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => setAppActive(st === 'active'));
    return () => sub.remove();
  }, []);

  // Tell the server what we have received (always) and read (only while the app is in the foreground).
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket?.connected) return;
    const maxId = messages.reduce((a, m) => Math.max(a, m.id || 0), 0);
    if (!maxId) return;
    const payload = {};
    if (maxId > reported.current.delivered) payload.delivered = maxId;
    if (appActive && maxId > reported.current.read) payload.read = maxId;
    if (!Object.keys(payload).length) return;
    reported.current = { ...reported.current, ...payload };
    socket.emit('receipt:update', payload);
  }, [messages, connected, appActive]);

  const setMessageStatus = (clientId, status) =>
    setMessages((prev) => prev.map((m) => (m.clientId === clientId ? { ...m, status } : m)));

  const deliver = useCallback(
    async (msg) => {
      const socket = socketRef.current;
      const payload = { text: msg.text, clientId: msg.clientId };
      try {
        if (socket?.connected) {
          // ack callback with timeout; server broadcasts the saved message
          const res = await socket.timeout(5000).emitWithAck('message:send', payload);
          if (!res.ok) throw new Error(res.error);
          setMessages((prev) => upsert(prev, res.message));
        } else {
          // socket is down: fall back to the REST endpoint
          const saved = await postMessage({ ...payload, username });
          setMessages((prev) => upsert(prev, saved));
        }
      } catch (e) {
        setMessageStatus(msg.clientId, 'failed');
        setError(e.message || 'Message failed to send.');
      }
    },
    [username]
  );

  const send = useCallback(
    (text) => {
      const msg = {
        clientId: makeClientId(),
        username,
        text: text.trim(),
        createdAt: new Date().toISOString(),
        status: 'sending',
      };
      setMessages((prev) => [...prev, msg]);
      deliver(msg);
    },
    [username, deliver]
  );

  const retry = useCallback(
    (clientId) => {
      setMessages((prev) => prev.map((m) => (m.clientId === clientId ? { ...m, status: 'sending' } : m)));
      const msg = messages.find((m) => m.clientId === clientId);
      if (msg) deliver(msg);
    },
    [messages, deliver]
  );

  // Emits typing=true, then typing=false after 1.5s of inactivity.
  const notifyTyping = useCallback(() => {
    const socket = socketRef.current;
    if (!socket?.connected) return;
    socket.emit('typing', true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => socket.emit('typing', false), 1500);
  }, []);

  const stopTyping = useCallback(() => {
    clearTimeout(typingTimer.current);
    socketRef.current?.emit('typing', false);
  }, []);

  return {
    messages, online, typing, connected, loading, error, receipts,
    send, retry, notifyTyping, stopTyping, dismissError: () => setError(null),
  };
}
