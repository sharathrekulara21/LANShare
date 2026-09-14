# LAN Share

LAN Share is a local-network file transfer app built for fast, private, and browser-based sharing between devices on the same Wi‑Fi or LAN. It is designed for situations where you want to move files quickly without uploading them to the cloud, creating accounts, or depending on internet access.

## Why this project exists

Many file transfer tools are optimized for cloud uploads, large SaaS accounts, or remote internet-based delivery. LAN Share solves a more direct problem:

- you are on the same local network as the other person
- you want to send files immediately
- you want privacy and speed
- you want a simple flow with no external service required

This is especially useful for:

- office or campus local networks
- home Wi‑Fi transfers between laptops and phones
- quick device-to-device sharing in workshops or team environments
- situations where cloud uploads are slow or not allowed

## How it works

The app uses a lightweight room-based flow:

1. One device creates a share room and receives a room code.
2. Another device joins using that code.
3. The app connects both devices over the local network.
4. Files are transferred directly between peers using a WebRTC data-channel flow.
5. The server is only used for signaling and coordination, not for storing the files themselves.

## Key features

- direct file transfer on the same local network
- room-based session creation and joining
- sender/receiver flow with clear session states
- real-time transfer status and progress
- no cloud dependency for the file payload itself
- simple browser-based UX for quick adoption

## Architecture

This project is split into two main parts:

### Client

The frontend lives in the `client` folder.

- built with Vite + React + TypeScript
- provides the UI for creating/joining sessions
- handles file selection, session state, and transfer actions
- communicates with the signaling server and the peer connection layer

### Server

The signaling server lives in the `server` folder.

- built with Node.js and Socket.IO
- manages session rooms and peer discovery
- allows devices to find and connect to each other
- coordinates the WebRTC signaling handshake

### Data flow

```
Client A -> Socket server -> room/session metadata
Client B -> Socket server -> room/session metadata
Client A <-> Client B -> WebRTC connection / file transfer
```

The actual file payload is transferred peer-to-peer instead of being routed through the app server.

## Local setup

### Prerequisites

Make sure you have the following installed:

- Node.js 18+
- npm

### 1. Install dependencies

From the project root:

```bash
cd client
npm install

cd ../server
npm install
```

### 2. Start the server

In the `server` folder:

```bash
npm run dev
```

If your server script is not configured for watch mode, you may need to run:

```bash
npm start
```

### 3. Start the client

In the `client` folder:

```bash
npm run dev
```

Then open the local Vite URL shown in the terminal, usually something like:

```bash
http://localhost:5173
```

### 4. Use the app

- On one device, click Send files and create a room.
- Copy the room code shown in the UI.
- On another device on the same network, join using that room code.
- Once connected, select a file and transfer it.

## Recommended usage scenarios

- quick transfer between computers on the same home or office Wi‑Fi
- sending large files without cloud upload limits
- demoing local peer-to-peer file exchange in a workshop or classroom
- internal transfer workflows within a networked environment

## Project structure

```text
LANShare/
├── client/
│   ├── src/
│   ├── package.json
│   ├── vite.config.ts
│   └── index.html
├── server/
│   ├── src/
│   └── package.json
├── README.md
└── Implementation.txt
```

## Security and privacy notes

This app is optimized for local use and is best suited for trusted networks. Because it is designed for LAN sharing, it does not rely on external cloud storage for the actual transfer.

For production-style deployments, you may still want to add:

- room access validation
- rate limiting
- session expiry controls
- better user feedback and retry logic
- stronger handling for unsupported browser conditions

## Development notes

The project is intentionally lightweight and focused on a simple user flow. The architecture keeps the app easy to extend if you later want to add:

- drag-and-drop upload
- multiple-file transfers
- transfer history
- QR-code join flow
- mobile-friendly UX improvements

## License

This project is intended for local development and learning how this works. It may be used by anyone for educational purposes, experimentation, and personal learning. It is not intended to be sold, redistributed as a production service, or used as a commercial deployment without additional review and licensing decisions.

## Summary

LAN Share is a simple and practical tool for sending files over the same local network without the complexity of cloud services. It is useful whenever you need a quick, private, and direct transfer path between devices on the same LAN.
