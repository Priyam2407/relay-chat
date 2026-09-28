(() => {
  const $ = (id) => document.getElementById(id);
  const KEY = 'relay.username';
  const USERNAME_RE = /^[a-zA-Z0-9_]{2,20}$/;
  const PAGE = 50;

  const state = { username: null, messages: [], online: [], typing: [], hasMore: false, socket: null, receipts: {}, unread: 0, loaded: false };
const reported = { delivered: 0, read: 0 };   // last values sent to the server
  const fresh = new Set();          // keys of messages that should animate in
  let typingTimer = null;
  let isTyping = false;

  /* ---------- helpers ---------- */
  const keyOf = (m) => (m.id ? `i${m.id}` : `c${m.clientId}`);
  const clientId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const timeStr = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const dayStr = (iso) => {
    const d = new Date(iso), t = new Date();
    const y = new Date(); y.setDate(t.getDate() - 1);
    if (d.toDateString() === t.toDateString()) return 'Today';
    if (d.toDateString() === y.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const colorOf = (name) => {
    let h = 0;
    for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
    return `hsl(${h} 45% 38%)`;
  };
  const avatar = (name, live) => {
    const el = document.createElement('div');
    el.className = 'avatar' + (live ? ' live' : '');
    el.style.background = colorOf(name);
    el.textContent = name[0].toUpperCase();
    return el;
  };

  // 'sent' -> 'delivered' -> 'read', based on what the other users have reported.
  function receiptOf(m) {
    if (m.username !== state.username || !m.id || m.status === 'sending' || m.status === 'failed') return null;
    const others = Object.entries(state.receipts).filter(([u]) => u !== state.username).map(([, r]) => r);
    if (others.some((r) => r.read >= m.id)) return 'read';
    if (others.some((r) => Math.max(r.delivered, r.read) >= m.id)) return 'delivered';
    return 'sent';
  }

  async function api(path, options) {
    let res;
    try {
      res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options });
    } catch {
      throw new Error('Cannot reach the server. Check your connection.');
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
    return body;
  }

  let toastTimer;
  function showError(text, ok = false) {
    const b = $('banner');
    b.textContent = text;
    b.classList.toggle('ok', ok);
    b.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (b.hidden = true), 4500);
  }
  $('banner').onclick = () => ($('banner').hidden = true);

  /* ---------- theme ---------- */
  const THEME_KEY = 'relay.theme';
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    $('themeToggle').textContent = t === 'dark' ? '☀️' : '🌙';
    document.querySelector('meta[name=theme-color]').content = t === 'dark' ? '#08161a' : '#0b1f24';
  }
  let savedTheme = null;
  try { savedTheme = localStorage.getItem(THEME_KEY); } catch { /* ignore */ }
  applyTheme(savedTheme || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  $('themeToggle').onclick = () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* ignore */ }
  };

  /* ---------- state updates ---------- */
  function upsert(msg) {
    const i = state.messages.findIndex(
      (m) => (msg.id && m.id === msg.id) || (msg.clientId && m.clientId === msg.clientId)
    );
    if (i === -1) {
      fresh.add(keyOf(msg));
      state.messages.push(msg);
    } else {
      state.messages[i] = { ...state.messages[i], ...msg, status: 'sent' };
    }
    state.messages.sort((a, b) => (a.id && b.id ? a.id - b.id : new Date(a.createdAt) - new Date(b.createdAt)));
  }

  /* ---------- rendering ---------- */
  const nearBottom = () => {
    const el = $('messages');
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };
  const scrollBottom = () => {
    const el = $('messages');
    el.scrollTop = el.scrollHeight;
    state.unread = 0;
    updatePill();
  };
  function updatePill() {
    const el = $('messages');
    const far = el.scrollHeight - el.scrollTop - el.clientHeight > 260;
    $('newPill').hidden = !(state.unread > 0 || far);
    $('newPill').textContent = state.unread > 0 ? `${state.unread} new message${state.unread > 1 ? 's' : ''} ↓` : '↓';
  }

  function renderMessages({ stick = false, quiet = false } = {}) {
    const box = $('messages');
    const prevTop = box.scrollTop;
    const wasNear = nearBottom();
    const list = $('list');
    list.textContent = '';
    let lastDay = '', prev = null;
    const frag = document.createDocumentFragment();

    for (const m of state.messages) {
      const day = dayStr(m.createdAt);
      if (day !== lastDay) {
        const d = document.createElement('div');
        d.className = 'day';
        d.textContent = day;
        frag.appendChild(d);
        lastDay = day;
        prev = null;
      }
      const own = m.username === state.username;
      // consecutive messages from one person within 5 minutes are visually grouped
      const grouped = prev && prev.username === m.username && new Date(m.createdAt) - new Date(prev.createdAt) < 5 * 60000;
      prev = m;

      const row = document.createElement('div');
      row.className = `row${own ? ' own' : ''}${grouped ? ' grouped' : ''}${m.status === 'sending' ? ' sending' : ''}${fresh.has(keyOf(m)) ? ' pop' : ''}`;
      if (!own) {
        if (grouped) { const sp = document.createElement('div'); sp.className = 'avatar-spacer'; row.appendChild(sp); }
        else row.appendChild(avatar(m.username, false));
      }

      const bubble = document.createElement('div');
      bubble.className = 'bubble';
      if (!own && !grouped) {
        const a = document.createElement('span');
        a.className = 'author';
        a.style.color = colorOf(m.username);
        a.textContent = m.username;
        bubble.appendChild(a);
      }
      const t = document.createElement('span');
      t.textContent = m.text;                     // textContent: no HTML injection
      bubble.appendChild(t);

      const meta = document.createElement('span');
      meta.className = 'meta';
      if (m.status === 'failed') {
        const b = document.createElement('button');
        b.className = 'retry';
        b.textContent = 'Not sent. Tap to retry';
        b.onclick = () => retry(m.clientId);
        meta.appendChild(b);
      } else {
        meta.append(m.status === 'sending' ? 'Sending…' : timeStr(m.createdAt));
        meta.title = new Date(m.createdAt).toLocaleString();
        const level = receiptOf(m);
        if (level) {
          const tick = document.createElement('span');
          tick.className = `tick ${level}`;
          tick.textContent = level === 'sent' ? '✓' : '✓✓';
          tick.title = level === 'read' ? 'Read' : level === 'delivered' ? 'Delivered' : 'Sent';
          meta.append(' ', tick);
        }
      }
      bubble.appendChild(meta);
      row.appendChild(bubble);
      frag.appendChild(row);
    }
    list.appendChild(frag);
    fresh.clear();

    $('skeleton').hidden = state.loaded;
    $('empty').hidden = !state.loaded || state.messages.length > 0;
    $('loadOlder').hidden = !state.hasMore;

    if (quiet) { box.scrollTop = prevTop; return; }   // receipt updates must not move the view
    const last = state.messages[state.messages.length - 1];
    if (stick || wasNear || (last && last.username === state.username)) scrollBottom();
    else updatePill();
  }

  function renderOnline() {
    $('onlineCount').textContent = state.online.length;
    const ul = $('onlineList');
    ul.textContent = '';
    for (const name of state.online) {
      const li = document.createElement('li');
      li.appendChild(avatar(name, true));
      const s = document.createElement('span');
      s.textContent = name;
      li.appendChild(s);
      if (name === state.username) {
        const y = document.createElement('span');
        y.className = 'you';
        y.textContent = 'you';
        li.appendChild(y);
      }
      ul.appendChild(li);
    }
  }

  function renderTyping() {
    const n = state.typing.length;
    const box = $('typing');
    box.textContent = '';
    if (!n) return;
    const dots = document.createElement('span');
    dots.className = 'dots';
    dots.innerHTML = '<i></i><i></i><i></i>';
    box.append(dots, n === 1 ? `${state.typing[0]} is typing` : `${n} people are typing`);
  }

  function setStatus(connected) {
    $('status').classList.toggle('on', connected);
    const others = state.online.filter((u) => u !== state.username);
    $('statusText').textContent = !connected
      ? 'Reconnecting…'
      : others.length ? `${others.length} other${others.length > 1 ? 's' : ''} online` : 'You are the only one here';
  }

  /* ---------- receipts ---------- */
  function reportSeen() {
    const s = state.socket;
    if (!s || !s.connected) return;
    const maxId = state.messages.reduce((a, m) => Math.max(a, m.id || 0), 0);
    if (!maxId) return;
    const payload = {};
    if (maxId > reported.delivered) payload.delivered = maxId;
    const watching = document.visibilityState === 'visible' && document.hasFocus();
    if (watching && maxId > reported.read) payload.read = maxId;
    if (!Object.keys(payload).length) return;
    Object.assign(reported, payload);
    s.emit('receipt:update', payload);
  }
  async function loadReceipts() {
    try {
      const { receipts } = await api('/api/receipts');
      state.receipts = Object.fromEntries(receipts.map((r) => [r.username, r]));
    } catch { /* ticks are optional; ignore */ }
  }

  /* ---------- data ---------- */
  async function loadHistory({ stick = true } = {}) {
    try {
      const { messages } = await api(`/api/messages?limit=${PAGE}`);
      const pending = state.messages.filter((m) => m.status === 'sending' || m.status === 'failed');
      state.messages = messages;
      if (state.olderLoaded == null) state.hasMore = messages.length === PAGE;
      pending.forEach(upsert);
      await loadReceipts();
      renderMessages({ stick });
      reportSeen();
    } catch (e) {
      showError(e.message);
    } finally {
      state.loaded = true;
      $('skeleton').hidden = true;
    }
  }

  $('loadOlder').onclick = async () => {
    const oldest = state.messages.find((m) => m.id);
    if (!oldest) return;
    const box = $('messages');
    const prevHeight = box.scrollHeight;
    try {
      const { messages } = await api(`/api/messages?limit=${PAGE}&before=${oldest.id}`);
      state.hasMore = messages.length === PAGE;
      state.olderLoaded = true;
      messages.forEach((m) => { if (!state.messages.some((x) => x.id === m.id)) state.messages.push(m); });
      state.messages.sort((a, b) => (a.id && b.id ? a.id - b.id : 0));
      renderMessages();
      box.scrollTop = box.scrollHeight - prevHeight;   // keep the reading position
    } catch (e) {
      showError(e.message);
    }
  };

  /* ---------- sending ---------- */
  function deliver(msg) {
    const payload = { text: msg.text, clientId: msg.clientId };
    const fail = (text) => {
      const m = state.messages.find((x) => x.clientId === msg.clientId);
      if (m) m.status = 'failed';
      renderMessages();
      showError(text || 'Message failed to send.');
    };
    const ok = (saved) => { upsert(saved); renderMessages(); reportSeen(); };

    if (state.socket && state.socket.connected) {
      state.socket.timeout(5000).emit('message:send', payload, (err, res) => {
        if (err) return fail('Server did not respond in time.');
        res.ok ? ok(res.message) : fail(res.error);
      });
    } else {
      // socket is down: use the REST endpoint instead
      api('/api/messages', { method: 'POST', body: JSON.stringify({ ...payload, username: state.username }) })
        .then((r) => ok(r.message))
        .catch((e) => fail(e.message));
    }
  }

  function send(text) {
    const msg = { clientId: clientId(), username: state.username, text: text.trim(), createdAt: new Date().toISOString(), status: 'sending' };
    upsert(msg);
    renderMessages({ stick: true });
    deliver(msg);
  }

  function retry(id) {
    const m = state.messages.find((x) => x.clientId === id);
    if (!m) return;
    m.status = 'sending';
    renderMessages();
    deliver(m);
  }

  /* ---------- socket ---------- */
  function connect() {
    const socket = io({ auth: { username: state.username }, reconnectionDelayMax: 5000 });
    state.socket = socket;

    socket.on('connect', () => { setStatus(true); $('banner').hidden = true; loadHistory({ stick: false }); });
    socket.on('disconnect', () => { state.typing = []; renderTyping(); setStatus(false); });
    socket.on('connect_error', (e) => { setStatus(false); showError(e.message || 'Connection failed.'); });
    socket.on('message:new', (msg) => {
      if (msg.username !== state.username && !nearBottom()) state.unread++;
      upsert(msg); renderMessages(); reportSeen();
    });
    socket.on('receipts:update', (r) => { state.receipts[r.username] = r; renderMessages({ quiet: true }); });
    socket.on('presence:update', (list) => { state.online = list; renderOnline(); setStatus(socket.connected); });
    socket.on('typing:update', ({ username, isTyping: t }) => {
      state.typing = state.typing.filter((u) => u !== username);
      if (t) state.typing.push(username);
      renderTyping();
    });
  }

  function notifyTyping() {
    const s = state.socket;
    if (!s || !s.connected) return;
    if (!isTyping) { s.emit('typing', true); isTyping = true; }
    clearTimeout(typingTimer);
    typingTimer = setTimeout(stopTyping, 1500);
  }
  function stopTyping() {
    clearTimeout(typingTimer);
    if (isTyping && state.socket) state.socket.emit('typing', false);
    isTyping = false;
  }

  /* ---------- composer ---------- */
  const input = $('input');
  function syncComposer() {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 140)}px`;
    $('sendBtn').disabled = input.value.trim().length === 0;
    const left = 1000 - input.value.length;
    $('counter').textContent = left <= 200 ? `${left}` : '';
    $('counter').classList.toggle('warn', left <= 50);
  }
  input.addEventListener('input', () => { syncComposer(); notifyTyping(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('composer').requestSubmit(); }
  });
  $('composer').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!input.value.trim()) return;
    send(input.value);
    input.value = '';
    stopTyping();
    syncComposer();
    input.focus();
  });

  /* ---------- session / navigation ---------- */
  function start(name) {
    state.username = name;
    $('meName').textContent = name;
    $('meAvatar').replaceWith(Object.assign(avatar(name, true), { id: 'meAvatar' }));
    $('login').hidden = true;
    $('chat').hidden = false;
    renderOnline();
    setStatus(false);
    loadHistory();
    connect();
    input.focus();
  }

  $('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('usernameInput').value.trim();
    if (!USERNAME_RE.test(name)) {
      $('usernameInput').classList.add('invalid');
      $('loginError').textContent = 'Use 2-20 letters, numbers or underscores.';
      return;
    }
    try { localStorage.setItem(KEY, name); } catch { /* storage blocked: session only */ }
    start(name);
  });
  $('usernameInput').addEventListener('input', () => {
    $('usernameInput').classList.remove('invalid');
    $('loginError').textContent = '';
  });

  $('logout').onclick = () => {
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    location.reload();
  };
  $('newPill').onclick = scrollBottom;
  $('messages').addEventListener('scroll', () => { if (nearBottom()) state.unread = 0; updatePill(); });
  const side = (open) => { $('sidebar').classList.toggle('open', open); $('backdrop').hidden = !open; };
  $('openSidebar').onclick = () => side(true);
  $('closeSidebar').onclick = () => side(false);
  $('backdrop').onclick = () => side(false);
  window.addEventListener('beforeunload', stopTyping);
  window.addEventListener('focus', reportSeen);
  document.addEventListener('visibilitychange', reportSeen);

  /* ---------- login preview ---------- */
  const preview = (name) => {
    const p = $('previewAvatar');
    p.textContent = name ? name[0].toUpperCase() : '?';
    p.style.background = name ? colorOf(name) : 'var(--muted)';
    p.style.transform = name ? 'scale(1.06)' : 'scale(1)';
  };
  $('usernameInput').addEventListener('input', (e) => preview(e.target.value.trim()));
  $('randomName').onclick = () => {
    const a = ['Swift', 'Calm', 'Bright', 'Lucky', 'Brave', 'Quiet', 'Sunny', 'Witty'];
    const b = ['Otter', 'Falcon', 'Panda', 'Tiger', 'Koala', 'Heron', 'Lynx', 'Fox'];
    const pick = (l) => l[Math.floor(Math.random() * l.length)];
    const name = `${pick(a)}${pick(b)}${Math.floor(Math.random() * 90 + 10)}`;
    $('usernameInput').value = name;
    $('usernameInput').dispatchEvent(new Event('input'));
    $('usernameInput').focus();
  };
  preview('');

  /* ---------- emoji picker ---------- */
  const EMOJIS = '😀 😂 🥹 😍 😎 🤔 😅 😭 👍 👏 🙏 🔥 🎉 ❤️ ✨ 💯 👀 🙌 😴 🤝 🚀 ☕ 🍕 🌈'.split(' ');
  EMOJIS.forEach((em) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = em;
    b.setAttribute('aria-label', `Insert ${em}`);
    b.onclick = () => {
      const at = input.selectionStart ?? input.value.length;
      input.value = input.value.slice(0, at) + em + input.value.slice(input.selectionEnd ?? at);
      input.selectionStart = input.selectionEnd = at + em.length;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    };
    $('emojiPanel').appendChild(b);
  });
  $('emojiBtn').onclick = (e) => { e.stopPropagation(); $('emojiPanel').hidden = !$('emojiPanel').hidden; };
  document.addEventListener('click', (e) => { if (!$('emojiPanel').contains(e.target)) $('emojiPanel').hidden = true; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { $('emojiPanel').hidden = true; side(false); } });

  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch { /* ignore */ }
  if (saved && USERNAME_RE.test(saved)) start(saved);
  else $('usernameInput').focus();
})();
