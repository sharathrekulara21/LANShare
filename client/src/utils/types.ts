export type Role = "sender" | "receiver" | null;

export type ConnectionStatus =
	| "idle"
	| "waiting"
	| "connecting"
	| "connected"
	| "disconnected";

export type TransferStatus = "active" | "completed" | "failed";

export type TransferDirection = "sending" | "receiving";

export type TransferState = {
	fileName: string;
	totalBytes: number;
	transferredBytes: number;
	direction: TransferDirection;
	status: TransferStatus;
};

export type TransferManagerOptions = {
	getDataChannel: () => RTCDataChannel | null;

	getSaveDirectory: () => FileSystemDirectoryHandle | null;

	updateTransfer: (transferId: string, update: Partial<TransferState>) => void;

	addMessage: (message: string) => void;

	setStatus: (status: string) => void;

	setError: (error: string) => void;

	setPeerReady: (ready: boolean) => void;
};

export type FileStartMessage = {
	kind: "file-start";
	transferId: string;
	name: string;
	size: number;
	type: string;
	totalChunks: number;
};

export type FileEndMessage = {
	kind: "file-end";
	transferId: string;
};

export type FileCompleteMessage = {
	kind: "file-complete";
	transferId: string;
};

export type ReceiverReadyMessage = {
	kind: "receiver-ready";
};

export type ChatMessage = {
	kind: "chat";
	message: string;
};

export type ControlMessage =
	| FileStartMessage
	| FileEndMessage
	| FileCompleteMessage
	| ReceiverReadyMessage
	| ChatMessage;

export type IncomingTransfer = {
	transferId: string;

	fileName: string;
	fileSize: number;
	fileType: string;
	totalChunks: number;

	receivedBytes: number;
	receivedChunks: number;

	writable: FileSystemWritableFileStream | null;

	bufferChunks: Uint8Array[];

	/**
	 * Writes for this file are serialized.
	 *
	 * This queue is independent for every transfer.
	 */
	writeQueue: Promise<void>;

	/**
	 * Prevents processing EOF more than once.
	 */
	endReceived: boolean;

	/**
	 * Prevents duplicate chunks.
	 */
	receivedChunkIndexes: Set<number>;
};

export type OutgoingTransfer = {
	transferId: string;
	file: File;
	totalChunks: number;

	/**
	 * True once file-end has been sent.
	 */
	endSent: boolean;

	/**
	 * True once receiver sends file-complete.
	 */
	completed: boolean;
};
