import type { Socket } from "socket.io";

export const ROOM_CODE_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";

export const ROOM_CODE_LENGTH = 6;

export const ROOM_TTL_MS = 10 * 60 * 1000;

export const CLEANUP_INTERVAL_MS = 60 * 1000;

export type RoomEntry = {
	senderSocket: Socket | null;
	receiverSocket: Socket | null;
	lastActivity: number;
};

export const rooms = new Map<string, RoomEntry>();

export const generateRoomCode = (): string => {
	let roomCode = "";

	do {
		roomCode = Array.from({ length: ROOM_CODE_LENGTH }, () => {
			const index = Math.floor(Math.random() * ROOM_CODE_CHARS.length);

			return ROOM_CODE_CHARS[index];
		}).join("");
	} while (rooms.has(roomCode));

	return roomCode;
};

export const findRoomCodeForSocket = (socketId: string): string | null => {
	for (const [roomCode, room] of rooms.entries()) {
		if (
			room.senderSocket?.id === socketId ||
			room.receiverSocket?.id === socketId
		) {
			return roomCode;
		}
	}

	return null;
};

export const touchRoom = (roomCode: string): boolean => {
	const room = rooms.get(roomCode);

	if (!room) {
		return false;
	}

	room.lastActivity = Date.now();

	return true;
};

export const expireRoom = (
	roomCode: string,
	room: RoomEntry,
	message = "Session expired",
) => {
	for (const peerSocket of [room.senderSocket, room.receiverSocket]) {
		if (!peerSocket || !peerSocket.connected) {
			continue;
		}

		peerSocket.leave(roomCode);

		peerSocket.emit("room-expired", {
			code: roomCode,
			message,
		});
	}

	rooms.delete(roomCode);
};

export const cleanupExpiredRooms = () => {
	const now = Date.now();

	for (const [roomCode, room] of rooms.entries()) {
		if (now - room.lastActivity <= ROOM_TTL_MS) {
			continue;
		}

		expireRoom(roomCode, room);
	}
};
