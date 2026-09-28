# Relay: Real-Time Chat (React Native + Node.js + Socket.io)

A single-room real-time chat app.

- **Website:** plain HTML/CSS/JS in `backend/public/`, served by the backend at `/`
- **Mobile app:** React Native (Expo SDK 57), in `mobile/`
- **Backend:** Node.js + Express + Socket.io + SQLite, in `backend/`

## Features

- Send and receive messages instantly over Socket.io
- Message history persists in SQLite and reloads after a refresh or app restart
- Timestamps on every message
- REST APIs: `POST /api/messages`, `GET /api/messages`
- Graceful connect/disconnect handling with automatic reconnect
- Bonus: username login (dummy auth), typing indicator, online users, **delivered/read receipts** (✓ sent, ✓✓ delivered, amber ✓✓ read), retry on failed sends, SQLite storage

## Website (no build step)

Start the backend and open **http://localhost:4000**. The same server hosts the API, Socket.io and the website, so one deployment gives you a live site and a live API. Open it in two tabs with different usernames to see real-time chat.

Website features: username login (remembered), live messages, online list with avatars, typing indicator, date separators and timestamps, "Load earlier messages" pagination, "New messages" pill when scrolled up, retry on failed sends, reconnect banner, auto dark mode, responsive layout with a slide-in online panel on phones.

## Project structure

```
backend/
  src/
    server.js            HTTP + Socket.io bootstrap, graceful shutdown
    app.js               Express app, middleware, routes
    config.js            Environment-driven config
    db.js                SQLite connection and schema
    routes/              URL to controller mapping
    controllers/         HTTP request/response handling
    services/            Business logic and DB access (shared by REST and sockets)
    sockets/             Socket.io events (auth, messages, typing, presence)
    middleware/          404 and error handling
    utils/               Validation and error classes
backend/public/          The website (index.html, styles.css, app.js)
mobile/
  App.js                 Session handling (login / chat)
  src/screens/           LoginScreen, ChatScreen
  src/components/        MessageBubble, MessageInput
  src/hooks/useChat.js   All chat state and socket logic
  src/api/, src/socket/  REST client and socket factory
```

## Environment variables

**Backend** (`backend/.env`, copy from `.env.example`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4000` | Server port |
| `CORS_ORIGIN` | `*` | Allowed origins, comma-separated |
| `DB_PATH` | `./data/chat.db` | SQLite file location |

**Mobile** (`mobile/.env`, copy from `.env.example`)

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_API_URL` | Backend base URL. Android emulator: `http://10.0.2.2:4000`. Physical phone: `http://<computer-LAN-IP>:4000` or your deployed URL. |

## Run the backend

Requires Node 18+.

```bash
cd backend
cp .env.example .env
npm install
npm start          # or: npm run dev
```

Check it: `curl http://localhost:4000/health` returns `{"status":"ok"}`.

## Run the frontend

```bash
cd mobile
cp .env.example .env    # set EXPO_PUBLIC_API_URL
npm install
npx expo start
```

Then press `a` for an Android emulator, scan the QR code with Expo Go on a phone, or press `w` to run in the browser. The app targets Expo SDK 57, which matches the current Expo Go from the app stores. Expo Go requires you to be signed in to the same Expo account in the terminal (`npx expo login`) and in the app. To try real-time chat, open two clients with different usernames.

## Build an APK

```bash
cd mobile
npm install -g eas-cli
eas login
eas build -p android --profile preview
```

Set `EXPO_PUBLIC_API_URL` to your deployed backend URL before building, since the APK cannot reach `localhost`.

## REST API

| Method | Path | Body / Query | Notes |
|---|---|---|---|
| `POST` | `/api/messages` | `{ username, text, clientId? }` | Saves and broadcasts the message. Idempotent on `clientId`. |
| `GET` | `/api/messages` | `?limit=50&before=<id>` | Returns `{ messages }` oldest first. `before` enables pagination. |
| `GET` | `/api/receipts` | | Returns `{ receipts: [{ username, delivered, read }] }` |
| `GET` | `/health` | | Liveness check |

## Socket events

| Direction | Event | Payload |
|---|---|---|
| client to server | `message:send` | `{ text, clientId }` with an ack `{ ok, message | error }` |
| client to server | `typing` | `boolean` |
| client to server | `receipt:update` | `{ delivered?: id, read?: id }` highest message id received / seen |
| server to clients | `message:new` | saved message |
| server to clients | `presence:update` | array of online usernames |
| server to clients | `typing:update` | `{ username, isTyping }` |
| server to clients | `receipts:update` | `{ username, delivered, read }` |

The username is sent in the handshake `auth` and validated by a Socket.io middleware.

## Design decisions

- **Shared service layer.** REST and Socket.io both call `messageService`, so validation and persistence live in one place.
- **Server broadcasts on both paths.** A message sent over REST is also pushed to socket clients, so nothing depends on which transport the sender used.
- **Optimistic UI with idempotency.** The client shows a message immediately with a `clientId`. The server ignores duplicate `clientId`s, so retries never create duplicates, and the client merges the server copy into the optimistic one.
- **REST fallback.** If the socket is down when sending, the app posts over REST. Socket.io is still the primary real-time channel.
- **History on reconnect.** After every reconnect the app refetches history to recover messages missed while offline.
- **SQLite.** Zero-setup and persistent, which suits a single-server assignment. Swapping to MongoDB or Postgres only touches `messageService.js` and `db.js`.
- **Server-trusted identity.** For socket messages the username comes from the authenticated handshake, never from the payload.
- **Inverted FlatList** keeps the newest message pinned to the bottom without manual scrolling.

- **Receipts as per-user watermarks.** Instead of one row per message per user, the server stores the highest message id each user has received and read. Values only move forward, are clamped to real message ids, and the client derives the tick for each message from them. This stays cheap as history grows and survives reloads.

## Assumptions

- "Read" means the chat is open and in the foreground (window focused, or app active). "Delivered" means the client received the message.
- In this single-room chat, a message shows as delivered/read once at least one other user has received/read it.

- One global chat room (no private or group rooms).
- Login is a dummy username with no password. Anyone can claim any name, so this is not real authentication.
- Usernames are 2-20 characters (letters, numbers, underscore). Messages are up to 1000 characters.
- Timestamps are stored in UTC and shown in the device's local time.
- Presence and typing state are held in memory, so they assume a single backend instance. Scaling out would need the Socket.io Redis adapter.
- The history endpoint returns the latest 50 messages by default. The app loads that page on start, and the API supports older pages via `before`.
- SQLite needs a persistent disk in production. On hosts with ephemeral storage (e.g. Render free tier) history resets on redeploy.

## Deploying the backend (Render example)

1. Push the repo to GitHub.
2. Create a Render **Web Service**, root directory `backend`, build command `npm install`, start command `npm start`.
3. Add env vars from the table above. Attach a persistent disk and set `DB_PATH` to a path on it if you want history to survive redeploys.
4. Open the resulting `https://...onrender.com` URL: that is your live website. Use the same URL as `EXPO_PUBLIC_API_URL` for the APK.
