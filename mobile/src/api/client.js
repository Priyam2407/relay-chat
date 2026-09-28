import { API_URL } from '../config';

async function request(path, options) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch {
    throw new Error('Cannot reach the server. Check your connection.');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

export const fetchHistory = ({ limit = 50, before } = {}) => {
  const q = new URLSearchParams({ limit: String(limit) });
  if (before) q.set('before', String(before));
  return request(`/api/messages?${q}`).then((r) => r.messages);
};

export const postMessage = (payload) =>
  request('/api/messages', { method: 'POST', body: JSON.stringify(payload) }).then((r) => r.message);

export const fetchReceipts = () => request('/api/receipts').then((r) => r.receipts);
