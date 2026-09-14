import type { ControlMessage, FileCompleteMessage } from "./types";

export const CHUNK_SIZE = 128 * 1024;
export const HIGH_WATER_MARK = 1 * 1024 * 1024;
export const LOW_WATER_MARK = 256 * 1024;
export const TRANSFER_ID_BYTES = 36;
export const BINARY_HEADER_SIZE = TRANSFER_ID_BYTES + 4;

export type BinaryFrame = {
	transferId: string;
	chunkIndex: number;
	payload: ArrayBuffer;
};

export function generateTransferId(): string {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}

	throw new Error("crypto.randomUUID() is required for file transfers.");
}

export function isBinaryChunk(value: unknown): value is ArrayBuffer | Blob {
	return value instanceof ArrayBuffer || value instanceof Blob;
}

export function isControlMessage(value: unknown): value is ControlMessage {
	if (!value || typeof value !== "object") {
		return false;
	}

	const candidate = value as {
		kind?: unknown;
	};

	return (
		candidate.kind === "file-start" ||
		candidate.kind === "file-end" ||
		candidate.kind === "file-complete" ||
		candidate.kind === "receiver-ready" ||
		candidate.kind === "chat"
	);
}

export function encodeTransferId(transferId: string): Uint8Array {
	const transferIdBytes = new TextEncoder().encode(transferId);

	if (transferIdBytes.byteLength !== TRANSFER_ID_BYTES) {
		throw new Error("Invalid transfer ID length.");
	}

	return transferIdBytes;
}

export function encodeBinaryFrame(
	transferIdBytes: Uint8Array,
	chunkIndex: number,
	payload: ArrayBuffer,
): ArrayBuffer {
	if (
		!Number.isInteger(chunkIndex) ||
		chunkIndex < 0 ||
		chunkIndex > 0xffffffff
	) {
		throw new Error("Invalid chunk index.");
	}

	const frame = new Uint8Array(BINARY_HEADER_SIZE + payload.byteLength);

	frame.set(transferIdBytes, 0);

	const view = new DataView(frame.buffer);

	view.setUint32(TRANSFER_ID_BYTES, chunkIndex, false);

	frame.set(new Uint8Array(payload), BINARY_HEADER_SIZE);

	return frame.buffer;
}

export function decodeBinaryFrame(buffer: ArrayBuffer): BinaryFrame {
	if (buffer.byteLength < BINARY_HEADER_SIZE) {
		throw new Error("Received invalid binary frame.");
	}

	const decoder = new TextDecoder();

	const transferId = decoder.decode(
		new Uint8Array(buffer, 0, TRANSFER_ID_BYTES),
	);

	const view = new DataView(buffer);

	const chunkIndex = view.getUint32(TRANSFER_ID_BYTES, false);

	const payload = buffer.slice(BINARY_HEADER_SIZE);

	return {
		transferId,
		chunkIndex,
		payload,
	};
}

export function serializeControlMessage(message: ControlMessage): string {
	return JSON.stringify(message);
}

export function parseControlMessage(data: string): ControlMessage {
	const parsed = JSON.parse(data) as unknown;

	if (!isControlMessage(parsed)) {
		throw new Error("Received unknown control message.");
	}

	return parsed;
}

export function createFileCompleteMessage(
	transferId: string,
): FileCompleteMessage {
	return {
		kind: "file-complete",
		transferId,
	};
}
