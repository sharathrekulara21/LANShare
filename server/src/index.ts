import "dotenv/config";

import express from "express";
import { createServer } from "node:http";
import { Server, Socket } from "socket.io";

import {
	CLEANUP_INTERVAL_MS,
	ROOM_TTL_MS,
	cleanupExpiredRooms,
	findRoomCodeForSocket,
	generateRoomCode,
	removeSocketFromRoom,
	rooms,
} from "./rooms";

const app = express();

const httpServer = createServer(app);

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

const PORT = Number(process.env.PORT ?? 3000);

const io = new Server(httpServer, {
	cors: {
		origin: CLIENT_ORIGIN,
		methods: ["GET", "POST"],
		credentials: true,
	},
});

const expireRoomSafely = (roomCode: string, message: string) => {
	const room = rooms.get(roomCode);

	if (!room) {
		return;
	}

	for (const peerSocket of [room.senderSocket, room.receiverSocket]) {
		if (!peerSocket) {
			continue;
		}

		if (peerSocket.connected) {
			peerSocket.leave(roomCode);

			peerSocket.emit("room-expired", {
				code: roomCode,
				message,
			});
		}
	}

	rooms.delete(roomCode);

	console.log(`Room ${roomCode} expired: ${message}`);
};

io.on("connection", (socket) => {
	console.log(`User connected: ${socket.id}`);

	socket.on("create-room", () => {
		const existingRoom = findRoomCodeForSocket(socket.id);

		if (existingRoom) {
			socket.emit("room-error", {
				message: "You are already in a room.",
			});

			return;
		}

		const roomCode = generateRoomCode();

		rooms.set(roomCode, {
			senderSocket: socket,
			receiverSocket: null,
			lastActivity: Date.now(),
		});

		socket.join(roomCode);

		socket.emit("room-created", {
			code: roomCode,
			message: "Room created",
		});

		console.log(`Room ${roomCode} created by ${socket.id}`);
	});

	socket.on("leave-room", () => {
		const roomCode = removeSocketFromRoom(socket.id);

		if (roomCode) {
			console.log(`Socket ${socket.id} left room ${roomCode}`);
		}
	});

	socket.on("join-room", ({ code }: { code?: string }) => {
		const normalizedCode =
			typeof code === "string" ? code.trim().toLowerCase() : "";

		if (!normalizedCode) {
			socket.emit("room-error", {
				message: "Enter a room code.",
			});

			return;
		}

		const existingRoom = findRoomCodeForSocket(socket.id);

		if (existingRoom) {
			socket.emit("room-error", {
				message:
					existingRoom === normalizedCode
						? "You are already in this room."
						: "You are already in another room.",
			});

			return;
		}

		const room = rooms.get(normalizedCode);

		if (!room) {
			socket.emit("room-error", {
				message: "Invalid room code.",
			});

			return;
		}

		if (Date.now() - room.lastActivity > ROOM_TTL_MS) {
			expireRoomSafely(normalizedCode, "Session expired.");

			socket.emit("room-error", {
				message: "Invalid room code.",
			});

			return;
		}

		if (room.senderSocket && room.receiverSocket) {
			socket.emit("room-error", {
				message: "Room already has two participants.",
			});

			return;
		}

		room.receiverSocket = socket;
		room.lastActivity = Date.now();

		socket.join(normalizedCode);

		room.senderSocket?.emit("room-joined", {
			code: normalizedCode,
			message: "Pairing successful",
			role: "sender",
		});

		socket.emit("room-joined", {
			code: normalizedCode,
			message: "Pairing successful",
			role: "receiver",
		});

		console.log(`Socket ${socket.id} joined room ${normalizedCode}`);
	});

	/**
	 * IMPORTANT:
	 *
	 * Socket.IO is used ONLY for WebRTC signaling.
	 *
	 * File bytes and chat messages never pass through
	 * this handler.
	 */
	socket.on("relay-message", (payload) => {
		const roomCode = findRoomCodeForSocket(socket.id);

		if (!roomCode) {
			return;
		}

		const room = rooms.get(roomCode);

		if (!room) {
			return;
		}

		room.lastActivity = Date.now();

		socket.to(roomCode).emit("relay-message", payload);
	});

	socket.on("disconnect", () => {
		console.log(`User disconnected: ${socket.id}`);

		const roomCode = removeSocketFromRoom(socket.id);

		if (roomCode) {
			console.log(`Room ${roomCode} ended`);
		}
	});
});

export const startServer = () => {
	setInterval(cleanupExpiredRooms, CLEANUP_INTERVAL_MS);

	httpServer.listen(PORT, () => {
		console.log(`Server started on ${PORT}`);
	});
};

startServer();

export default io;
