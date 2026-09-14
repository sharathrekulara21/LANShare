import {
	decodeBinaryFrame,
	encodeBinaryFrame,
	generateTransferId,
	CHUNK_SIZE,
	HIGH_WATER_MARK,
	LOW_WATER_MARK,
	encodeTransferId,
} from "./transferProtocol";

import type {
	FileCompleteMessage,
	FileEndMessage,
	FileStartMessage,
	IncomingTransfer,
	OutgoingTransfer,
	TransferManagerOptions,
} from "./types";

export class TransferManager {
	private readonly options: TransferManagerOptions;

	private incomingTransfers = new Map<string, IncomingTransfer>();

	private outgoingTransfers = new Map<string, OutgoingTransfer>();

	private completedIncomingTransfers = new Set<string>();

	private incomingMessageQueue = Promise.resolve();

	constructor(options: TransferManagerOptions) {
		this.options = options;
	}

	public getIncomingTransfers() {
		return this.incomingTransfers;
	}

	public getOutgoingTransfers() {
		return this.outgoingTransfers;
	}

	public destroy(): void {
		for (const transfer of this.incomingTransfers.values()) {
			if (!transfer.writable) {
				continue;
			}

			void transfer.writable.abort().catch(() => {
				// Ignore cleanup errors.
			});
		}

		this.incomingTransfers.clear();
		this.outgoingTransfers.clear();

		this.completedIncomingTransfers.clear();

		this.incomingMessageQueue = Promise.resolve();
	}

	/**
	 * Processes EVERY incoming DataChannel message
	 * through one ordered queue.
	 */
	public enqueueIncomingMessage(
		message:
			| ArrayBuffer
			| Blob
			| FileStartMessage
			| FileEndMessage
			| FileCompleteMessage
			| {
					kind: "receiver-ready";
			  }
			| {
					kind: "chat";
					message: string;
			  },
	): void {
		this.incomingMessageQueue = this.incomingMessageQueue
			.then(async () => {
				if (message instanceof ArrayBuffer) {
					await this.handleBinaryFrame(message);

					return;
				}

				if (message instanceof Blob) {
					const buffer = await message.arrayBuffer();

					await this.handleBinaryFrame(buffer);

					return;
				}

				await this.handleControlMessage(message);
			})
			.catch((error) => {
				console.error("Incoming transfer processing failed:", error);

				this.options.setError(
					error instanceof Error
						? error.message
						: "Failed to process incoming data.",
				);
			});
	}

	private async handleControlMessage(
		message:
			| FileStartMessage
			| FileEndMessage
			| FileCompleteMessage
			| {
					kind: "receiver-ready";
			  }
			| {
					kind: "chat";
					message: string;
			  },
	): Promise<void> {
		switch (message.kind) {
			case "file-start":
				await this.handleFileStart(message);
				return;

			case "file-end":
				await this.handleFileEnd(message);
				return;

			case "file-complete":
				this.handleFileComplete(message);
				return;

			case "receiver-ready":
				this.options.setPeerReady(true);

				return;

			case "chat":
				this.options.addMessage(`Peer: ${message.message}`);

				return;
		}
	}

	private async createIncomingWriter(
		fileName: string,
	): Promise<FileSystemWritableFileStream | null> {
		const directory = this.options.getSaveDirectory();

		if (!directory) {
			return null;
		}

		const directoryWithPermission = directory as FileSystemDirectoryHandle & {
			queryPermission?: (options: {
				mode: "readwrite";
			}) => Promise<PermissionState>;
		};

		const permission = directoryWithPermission.queryPermission
			? await directoryWithPermission.queryPermission({
					mode: "readwrite",
				})
			: "granted";

		if (permission !== "granted") {
			return null;
		}

		const fileHandle = await directory.getFileHandle(fileName, {
			create: true,
		});

		return fileHandle.createWritable();
	}

	private triggerDownload(blob: Blob, fileName: string): void {
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement("a");

		anchor.href = url;
		anchor.download = fileName;
		anchor.rel = "noopener";
		anchor.style.display = "none";

		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();

		setTimeout(() => URL.revokeObjectURL(url), 0);
	}

	private async handleFileStart(message: FileStartMessage): Promise<void> {
		/**
		 * A new file-start means this ID is being
		 * introduced again.
		 */
		this.completedIncomingTransfers.delete(message.transferId);

		const existing = this.incomingTransfers.get(message.transferId);

		if (existing) {
			try {
				if (existing.writable) {
					await existing.writable.abort();
				}
			} catch {
				// Ignore cleanup failure.
			}

			this.incomingTransfers.delete(message.transferId);
		}

		const writable = await this.createIncomingWriter(message.name);

		const transfer: IncomingTransfer = {
			transferId: message.transferId,

			fileName: message.name,

			fileSize: message.size,

			fileType: message.type || "application/octet-stream",

			totalChunks: message.totalChunks,

			receivedBytes: 0,

			receivedChunks: 0,

			writable,

			bufferChunks: [],

			writeQueue: Promise.resolve(),

			endReceived: false,

			receivedChunkIndexes: new Set<number>(),
		};

		this.incomingTransfers.set(message.transferId, transfer);

		this.options.updateTransfer(message.transferId, {
			fileName: message.name,

			totalBytes: message.size,

			transferredBytes: 0,

			direction: "receiving",

			status: "active",
		});

		this.options.setStatus(`Receiving ${message.name}`);
	}

	private async handleBinaryFrame(buffer: ArrayBuffer): Promise<void> {
		const { transferId, chunkIndex, payload } = decodeBinaryFrame(buffer);

		const transfer = this.incomingTransfers.get(transferId);

		/**
		 * This can happen if a stale DataChannel
		 * delivers a packet after the transfer
		 * has already completed.
		 *
		 * It should NOT destroy the entire session.
		 */
		if (!transfer) {
			if (this.completedIncomingTransfers.has(transferId)) {
				console.warn("Ignoring late chunk for completed transfer:", transferId);

				return;
			}

			console.warn("Received data for unknown transfer:", transferId);

			return;
		}

		if (transfer.endReceived) {
			console.warn("Ignoring chunk received after EOF:", transferId);

			return;
		}

		if (chunkIndex >= transfer.totalChunks) {
			throw new Error(
				`Invalid chunk index ${chunkIndex} for ${transfer.fileName}.`,
			);
		}

		if (transfer.receivedChunkIndexes.has(chunkIndex)) {
			console.warn("Duplicate chunk ignored:", transferId, chunkIndex);

			return;
		}

		transfer.receivedChunkIndexes.add(chunkIndex);

		const chunkBytes = new Uint8Array(payload);

		if (transfer.writable) {
			const writeStartedAt = performance.now();

			transfer.writeQueue = transfer.writeQueue.then(async () => {
				await transfer.writable!.write({
					type: "write",
					position: chunkIndex * CHUNK_SIZE,
					data: chunkBytes,
				});

				const writeDuration = performance.now() - writeStartedAt;

				if (writeDuration > 20) {
					console.warn(
						`Slow write for chunk ${chunkIndex}: ${writeDuration.toFixed(1)}ms`,
					);
				}
			});
		} else {
			transfer.bufferChunks[chunkIndex] = chunkBytes;
		}

		transfer.receivedBytes += payload.byteLength;

		transfer.receivedChunks++;

		this.options.updateTransfer(transferId, {
			transferredBytes: transfer.receivedBytes,
		});
	}

	private async handleFileEnd(message: FileEndMessage): Promise<void> {
		/**
		 * VERY IMPORTANT:
		 *
		 * An EOF for a completed/unknown transfer
		 * is not a fatal error.
		 */
		if (this.completedIncomingTransfers.has(message.transferId)) {
			console.warn("Ignoring duplicate file-end:", message.transferId);

			return;
		}

		const transfer = this.incomingTransfers.get(message.transferId);

		if (!transfer) {
			console.warn("Ignoring EOF for unknown transfer:", message.transferId);

			return;
		}

		if (transfer.endReceived) {
			console.warn("Ignoring duplicate EOF:", message.transferId);

			return;
		}

		transfer.endReceived = true;

		try {
			/**
			 * Every preceding binary message has already
			 * been processed by the incoming message queue.
			 *
			 * The writeQueue contains the actual disk writes.
			 */
			await transfer.writeQueue;

			if (transfer.receivedBytes !== transfer.fileSize) {
				throw new Error(
					`Incomplete file "${transfer.fileName}". ` +
						`Expected ${transfer.fileSize} bytes, ` +
						`received ${transfer.receivedBytes}.`,
				);
			}

			if (transfer.receivedChunks !== transfer.totalChunks) {
				throw new Error(
					`Incomplete file "${transfer.fileName}". ` +
						`Expected ${transfer.totalChunks} chunks, ` +
						`received ${transfer.receivedChunks}.`,
				);
			}

			if (transfer.writable) {
				await transfer.writable.close();
			} else {
				const blob = new Blob(
					transfer.bufferChunks.map((chunk) => chunk as unknown as BlobPart),
					{
						type: transfer.fileType,
					},
				);

				this.triggerDownload(blob, transfer.fileName);
			}

			this.incomingTransfers.delete(message.transferId);

			this.completedIncomingTransfers.add(message.transferId);

			this.options.updateTransfer(message.transferId, {
				status: "completed",

				transferredBytes: transfer.fileSize,
			});

			this.options.addMessage(`File received: ${transfer.fileName}`);

			this.options.setStatus(`Received ${transfer.fileName}`);

			/**
			 * Tell sender that the file is ACTUALLY
			 * complete on disk.
			 */
			this.sendControl({
				kind: "file-complete",
				transferId: message.transferId,
			});
		} catch (error) {
			console.error("Incoming transfer failed:", error);

			try {
				if (transfer.writable) {
					await transfer.writable.abort();
				}
			} catch {
				// Ignore cleanup failure.
			}

			this.incomingTransfers.delete(message.transferId);

			this.options.updateTransfer(message.transferId, {
				status: "failed",
			});

			this.options.setError(
				error instanceof Error ? error.message : "File transfer failed.",
			);
		}
	}

	private handleFileComplete(message: FileCompleteMessage): void {
		const transfer = this.outgoingTransfers.get(message.transferId);

		if (!transfer) {
			console.warn(
				"Ignoring file-complete for unknown outgoing transfer:",
				message.transferId,
			);

			return;
		}

		transfer.completed = true;

		const state = transfer.completed ? "completed" : "active";

		this.options.updateTransfer(message.transferId, {
			status: state,
			transferredBytes: transfer.file.size,
		});

		this.options.addMessage(`File sent: ${transfer.file.name}`);

		this.options.setStatus(`Sent ${transfer.file.name}`);

		this.outgoingTransfers.delete(message.transferId);
	}

	private sendControl(
		message:
			| FileStartMessage
			| FileEndMessage
			| FileCompleteMessage
			| {
					kind: "receiver-ready";
			  }
			| {
					kind: "chat";
					message: string;
			  },
	): boolean {
		const channel = this.options.getDataChannel();

		if (!channel || channel.readyState !== "open") {
			return false;
		}

		channel.send(JSON.stringify(message));

		return true;
	}

	private waitForDrainSignal(channel: RTCDataChannel): Promise<void> {
		return new Promise((resolve, reject) => {
			const handleLow = () => {
				channel.removeEventListener("bufferedamountlow", handleLow);

				if (channel.readyState === "open") {
					resolve();
					return;
				}

				reject(new Error("Data channel closed while sending the file."));
			};

			channel.bufferedAmountLowThreshold = LOW_WATER_MARK;

			channel.addEventListener("bufferedamountlow", handleLow, {
				once: true,
			});
		});
	}

	private waitForBufferedAmount(channel: RTCDataChannel): Promise<void> {
		if (channel.readyState !== "open") {
			return Promise.reject(new Error("Data channel is not open."));
		}

		if (channel.bufferedAmount <= HIGH_WATER_MARK) {
			return Promise.resolve();
		}

		return new Promise((resolve, reject) => {
			const handleLow = () => {
				channel.removeEventListener("bufferedamountlow", handleLow);

				if (channel.readyState === "open") {
					resolve();
					return;
				}

				reject(new Error("Data channel closed while sending the file."));
			};

			channel.bufferedAmountLowThreshold = LOW_WATER_MARK;

			channel.addEventListener("bufferedamountlow", handleLow, {
				once: true,
			});
		});
	}

	public async sendFile(file: File): Promise<void> {
		const channel = this.options.getDataChannel();

		if (!channel || channel.readyState !== "open") {
			throw new Error("Data channel is not open.");
		}

		const transferId = generateTransferId();
		const transferIdBytes = encodeTransferId(transferId);

		const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

		const transfer: OutgoingTransfer = {
			transferId,
			file,
			totalChunks,
			endSent: false,
			completed: false,
		};

		this.outgoingTransfers.set(transferId, transfer);

		this.options.updateTransfer(transferId, {
			fileName: file.name,
			totalBytes: file.size,
			transferredBytes: 0,
			direction: "sending",
			status: "active",
		});

		try {
			this.sendControl({
				kind: "file-start",
				transferId,
				name: file.name,
				size: file.size,
				type: file.type || "application/octet-stream",
				totalChunks,
			});

			let offset = 0;
			let chunkIndex = 0;

			const sendChunk = async (chunkBytes: Uint8Array): Promise<void> => {
				const payload = chunkBytes.buffer.slice(
					chunkBytes.byteOffset,
					chunkBytes.byteOffset + chunkBytes.byteLength,
				);

				const frame = encodeBinaryFrame(transferIdBytes, chunkIndex, payload);

				let sent = false;

				while (!sent) {
					const sendChannel = this.options.getDataChannel();

					if (!sendChannel || sendChannel.readyState !== "open") {
						throw new Error("Connection closed while sending the file.");
					}

					if (sendChannel.bufferedAmount > HIGH_WATER_MARK) {
						await this.waitForBufferedAmount(sendChannel);
					}

					try {
						sendChannel.send(frame);
						sent = true;
					} catch (error) {
						if (
							error instanceof DOMException &&
							error.name === "OperationError"
						) {
							console.warn(
								`Send queue full at chunk ${chunkIndex}; waiting for buffer to drain.`,
							);

							await this.waitForDrainSignal(sendChannel);

							continue;
						}

						if (
							error instanceof DOMException &&
							error.name === "InvalidStateError"
						) {
							throw new Error("Connection closed while sending the file.");
						}

						throw error;
					}
				}

				offset += chunkBytes.byteLength;
				chunkIndex++;

				this.options.updateTransfer(transferId, {
					transferredBytes: offset,
				});
			};

			/**
			 * Read the file as one continuous stream instead of
			 * many repeated Blob.slice()/arrayBuffer() calls -
			 * each of those pays a fresh per-call setup cost that
			 * dominates at this chunk count.
			 */
			const reader = file.stream().getReader();

			let leftover = new Uint8Array(0);
			let streamDone = false;

			while (!streamDone || leftover.byteLength > 0) {
				while (leftover.byteLength < CHUNK_SIZE && !streamDone) {
					const { value, done } = await reader.read();

					if (done) {
						streamDone = true;
						break;
					}

					const combined = new Uint8Array(
						leftover.byteLength + value.byteLength,
					);

					combined.set(leftover, 0);
					combined.set(value, leftover.byteLength);

					leftover = combined;
				}

				if (leftover.byteLength >= CHUNK_SIZE) {
					const chunk = leftover.subarray(0, CHUNK_SIZE);

					leftover = leftover.slice(CHUNK_SIZE);

					await sendChunk(chunk);
				} else if (streamDone && leftover.byteLength > 0) {
					const chunk = leftover;

					leftover = new Uint8Array(0);

					await sendChunk(chunk);
				}
			}

			await this.waitForBufferedAmount(channel);

			this.sendControl({
				kind: "file-end",
				transferId,
			});

			transfer.endSent = true;

			await this.waitForCompletion(transferId);
		} catch (error) {
			this.outgoingTransfers.delete(transferId);

			this.options.updateTransfer(transferId, {
				status: "failed",
			});

			if (
				error instanceof Error &&
				(error.message.includes("closed") || error.message.includes("not open"))
			) {
				this.options.setError(
					"Connection closed while sending the file. Please reconnect and retry.",
				);
				return;
			}

			throw error;
		}
	}

	private waitForCompletion(transferId: string): Promise<void> {
		return new Promise((resolve, reject) => {
			const startedAt = Date.now();

			const timeout = 10 * 60 * 1000;

			const check = () => {
				const transfer = this.outgoingTransfers.get(transferId);

				if (!transfer) {
					/**
					 * handleFileComplete() removes it
					 * after setting completed.
					 */
					resolve();
					return;
				}

				if (transfer.completed) {
					resolve();
					return;
				}

				if (Date.now() - startedAt > timeout) {
					this.outgoingTransfers.delete(transferId);

					reject(
						new Error(
							`Timed out waiting for receiver confirmation for "${transfer.file.name}".`,
						),
					);

					return;
				}

				setTimeout(check, 100);
			};

			check();
		});
	}

	public sendChat(message: string): boolean {
		return this.sendControl({
			kind: "chat",
			message,
		});
	}

	public sendReceiverReady(): boolean {
		return this.sendControl({
			kind: "receiver-ready",
		});
	}
}
