# Client README

This folder contains the browser app for LAN Share. It is the frontend interface that users open to start a local file-sharing session, create or join a room, and exchange files with another device on the same network.

## Purpose

The client is responsible for:

- rendering the user experience for sending or receiving files
- creating or joining a room through the signaling server
- managing the WebRTC connection with the peer
- selecting the files to send
- tracking the transfer lifecycle and progress
- updating the UI as the session grows, completes, or resets

## Architecture overview

The client is split into a few layers that work together:

1. UI layer
   - React components render the session, status, and transfer screens
   - the UI makes decisions based on the current mode, connected state, and transfer state

2. Session orchestration layer
   - `useShareSession.ts` owns WebRTC and room lifecycle state
   - it connects the socket events to peer connection setup and data channel readiness

3. Transfer layer
   - `transferProtocol.ts` defines the message format used on the WebRTC data channel
   - `transferManager.ts` handles file framing, queueing, and progress tracking

4. Signaling layer
   - `services/socket.ts` manages Socket.IO room creation, joining, and relay messaging

## Main files and responsibilities

### `src/App.tsx`

This is the app root component. It is responsible for mounting the main share experience into the browser.

### `src/main.tsx`

This is the application entry point. It creates the React root and renders the app into the DOM.

### `src/index.css`

This file contains the global styling for the app, including the dark console-inspired theme, spacing, shadows, button styles, and the app-wide visual system.

### `src/components/SharePanel.tsx`

This is the main screen and central UI container for the app.

It includes:

- connection and session status
- room code display and copy action
- send/receive mode selector
- transfer controls
- active transfer list
- reset session button

This is the main component users interact with during a session.

### `src/components/StatusCard.tsx`

This component shows the current session state in a compact card format, such as waiting, connected, transfer active, or session reset.

### `src/components/ConnectionBadge.tsx`

This displays the connection state visually, helping the user understand whether the app is ready, connected, or waiting for a peer.

### `src/components/ModeSelector.tsx`

This handles the role choice flow: the user picks whether they want to send files or receive them.

### `src/components/FunctionTransferPanel.tsx`

This manages the action panel for the active mode. It typically displays the file-picker experience for sending or the waiting state for receiving.

### `src/components/TransferList.tsx`

This renders the current transfer activity, including:

- file names
- transfer progress
- status labels such as queued, in progress, complete, or error
- completion metadata for active sessions

### `src/components/SectionHeader.tsx`

A reusable heading component used to structure sections in the product-like dashboard layout.

### `src/services/socket.ts`

This file wraps the Socket.IO client communication layer.

It exposes the app-facing API for:

- creating a room
- joining a room
- sending relay messages between peers
- listening for room events and signaling events

The socket service is the glue between the browser app and the signaling server.

### `src/utils/useShareSession.ts`

This is the most important logic file in the frontend.

It handles the full session lifecycle:

- role selection
- room code tracking
- peer connection setup
- signaling coordination
- data channel creation
- connection readiness
- file transfer orchestration
- reset behavior

It is effectively the control center for the app. The hook keeps track of connection state, method calls, and transfer status, then updates the UI accordingly.

### `src/utils/transferProtocol.ts`

This file defines the binary protocol used to transfer file data through the WebRTC data channel.

It includes logic for:

- chunk sizing
- frame creation and parsing
- transfer ID generation
- control message serialization
- binary payload framing

This gives the app a structured way to send file metadata and chunks over a single data channel without corrupting the stream.

### `src/utils/transferManager.ts`

This is the file transfer engine for the client.

Responsibilities include:

- receiving incoming transfer messages
- parsing controls like start and end events
- creating writable targets for incoming files
- queuing incoming binary chunks
- updating progress as chunks are received
- tracking file completion and final states

This module turns the raw WebRTC channel data into meaningful file transfer behavior for the user.

### `src/utils/types.ts`

This file defines the TypeScript interfaces and shared models used across the app.

It contains the common data shapes for:

- role and status values
- transfer metadata and payloads
- message contracts for signaling and file exchange
- internal records for the session lifecycle

This keeps the frontend logic strongly typed and easier to reason about.

## Session flow

The client follows this path during a typical LAN Share session:

1. The user selects whether they want to send or receive files.
2. The app creates a room or joins an existing room using the signaling server.
3. Socket.IO sends the room information and peer negotiation events.
4. The client creates a WebRTC peer connection.
5. Offer/answer and ICE candidate messages are relayed between peers.
6. The data channel is established.
7. The sender selects files and starts transfer.
8. The receiver reconstructs the files and updates the UI with progress and completion.
9. The user can reset the session when they want to start a new room flow.

## Why the frontend is structured this way

The app tries to keep responsibilities cleanly separated:

- components handle the interface
- the session hook handles live networking state
- transfer utilities handle bytes and file framing
- the socket layer handles room coordination

That separation makes the app easier to maintain, debug, and extend.

## Environment usage

The frontend usually depends on environment variables such as:

- `VITE_SOCKET_URL`
- other local app settings if required by the deployment environment

These are typically stored in a local `.env` file and should follow the project example values.

## Summary

The client is the visual and behavioral layer of LAN Share. It is the part that makes the peer-to-peer local transfer experience feel smooth, clear, and easy to control.

In short, the client coordinates:

- room setup
- WebRTC connection establishment
- transfer state
- progress updates
- user interaction

while the signaling server handles discovery and coordination between devices.
