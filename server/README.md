# Server README

This folder contains the signaling server for LAN Share. The server does not transfer the file payload itself; instead, it helps two browser clients find each other and negotiate a direct WebRTC connection.

## Purpose

The server is responsible for:

- creating and tracking temporary rooms
- assigning room codes
- connecting a sender to a receiver
- forwarding WebRTC signaling messages
- cleaning up expired or disconnected rooms

## Architecture overview

The server is intentionally simple and focused on coordination.

It has two main responsibilities:

1. Session management
   - room creation
   - room lookup
   - room expiration and cleanup

2. Signal relay
   - offer/answer exchange
   - ICE candidate transport
   - safe forwarding between connected peers in the same room

## Main files and responsibilities

### `src/index.ts`

This is the main server entry file.

It does the following:

- creates the Express app and HTTP server
- creates the Socket.IO server with CORS enabled for the client origin
- listens for `create-room`, `join-room`, and `relay-message` events
- matches sockets to their room
- emits room lifecycle events like `room-created`, `room-joined`, and `room-expired`
- cleans up disconnected users and removes rooms as needed

Important note: WebRTC signaling uses Socket.IO only. The actual file bytes are not sent through this server.

### `src/rooms.ts`

This file contains the room registry and core room logic.

Responsibilities:

- define room metadata
- generate unique room codes
- find which room a socket belongs to
- expire stale room sessions
- remove stale or disconnected room entries

Key exports include:

- `rooms`: the in-memory map of room codes to room entries
- `generateRoomCode()`: creates a random six-character code
- `findRoomCodeForSocket(socketId)`: returns the active room for a socket
- `cleanupExpiredRooms()`: removes expired sessions automatically

## Room model

Each room contains:

- `senderSocket`: the socket that created the room
- `receiverSocket`: the socket that joined the room
- `lastActivity`: timestamp used for expiration and stale cleanup

This ensures the app can keep a temporary pairing alive while the share session is active.

## Event flow

### Create room

When a sender creates a room:

- a new room code is generated
- the sender socket is assigned as the room owner
- the sender joins the room namespace
- the server emits `room-created` back to the client

### Join room

When a receiver joins:

- the code is validated
- the room is checked for availability and expiration
- the receiver is attached to the room
- the sender and receiver are both notified with `room-joined`

### Relay signaling

For WebRTC negotiation:

- the client sends `relay-message` events
- the server looks up the current room for that socket
- it forwards the payload to the other peer in the same room

This is how offers, answers, and ICE candidates move between client browsers.

### Disconnect cleanup

When a peer disconnects:

- the server removes the socket from the room
- the other peer is notified that the room expired
- the room is deleted from memory

## Why the server is lightweight

The server intentionally does not store files or host the transfer data. That design keeps the backend simple and ensures the actual file transfer stays local and peer-to-peer.

This also reduces the server-side complexity and avoids duplicating large file payloads through the central server.

## Environment variables

The server expects configuration such as:

- `PORT`
- `CLIENT_ORIGIN`

These should be provided through a local `.env` file using the example provided in the project.

## Startup flow

When the server starts:

- Express creates the HTTP server
- Socket.IO attaches to that server
- the app listens on the configured port
- a cleanup interval runs to delete stale rooms automatically

## Summary

The server is the coordination layer for LAN Share. It is responsible for pairing users into a room and relaying the signaling required for WebRTC peer setup, while keeping the actual transfer local, private, and efficient.
