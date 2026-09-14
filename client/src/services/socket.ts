import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? "http://localhost:3000";

export type RoomCreatedEvent = {
	code: string;
	message: string;
};

export type RoomStatusEvent = {
	code: string;
	message: string;
	role?: "sender" | "receiver";
};

export type RoomErrorEvent = {
	message: string;
};

export type RoomExpiredEvent = {
	code: string;
	message: string;
};

export type RelayPayload = {
	type?: "offer" | "answer" | "ice-candidate";
	offer?: RTCSessionDescriptionInit;
	answer?: RTCSessionDescriptionInit;
	candidate?: RTCIceCandidateInit;
};

const socket = io(SOCKET_URL, {
	transports: ["websocket"],
});

export const createRoom = () => {
	socket.emit("create-room");
};

export const joinRoom = (code: string) => {
	socket.emit("join-room", { code });
};

export const leaveRoom = () => {
	socket.emit("leave-room");
};

export const relayMessage = (payload: RelayPayload) => {
	socket.emit("relay-message", payload);
};

export const subscribeToRoomCreated = (
	callback: (event: RoomCreatedEvent) => void,
) => {
	socket.on("room-created", callback);

	return () => {
		socket.off("room-created", callback);
	};
};

export const subscribeToRoomJoined = (
	callback: (event: RoomStatusEvent) => void,
) => {
	socket.on("room-joined", callback);

	return () => {
		socket.off("room-joined", callback);
	};
};

export const subscribeToRoomError = (
	callback: (event: RoomErrorEvent) => void,
) => {
	socket.on("room-error", callback);

	return () => {
		socket.off("room-error", callback);
	};
};

export const subscribeToRoomExpired = (
	callback: (event: RoomExpiredEvent) => void,
) => {
	socket.on("room-expired", callback);

	return () => {
		socket.off("room-expired", callback);
	};
};

export const subscribeToRelayMessage = (
	callback: (payload: RelayPayload) => void,
) => {
	socket.on("relay-message", callback);

	return () => {
		socket.off("relay-message", callback);
	};
};

export function formatBytes(bytes: number) {
	if (bytes === 0) {
		return "0 B";
	}

	const units = ["B", "KB", "MB", "GB", "TB"];
	const index = Math.min(
		Math.floor(Math.log(bytes) / Math.log(1024)),
		units.length - 1,
	);

	const value = bytes / Math.pow(1024, index);

	return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}
