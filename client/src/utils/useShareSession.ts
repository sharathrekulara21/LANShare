import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type ChangeEvent,
} from "react";

import {
	createRoom,
	joinRoom,
	relayMessage,
	subscribeToRelayMessage,
	subscribeToRoomCreated,
	subscribeToRoomError,
	subscribeToRoomExpired,
	subscribeToRoomJoined,
} from "../services/socket";

import { isBinaryChunk, parseControlMessage } from "./transferProtocol";

import { TransferManager } from "./transferManager";

import type { ConnectionStatus, Role, TransferState } from "./types";

const STUN_SERVER = import.meta.env.VITE_STUN_SERVER;

export function useShareSession() {
	const [message, setMessage] = useState("");

	const [roomCode, setRoomCode] = useState("");

	const [joinCode, setJoinCode] = useState("");

	const [status, setStatus] = useState("Ready to connect");

	const [error, setError] = useState("");

	const [role, setRole] = useState<Role>(null);

	const [messages, setMessages] = useState<string[]>([]);

	const [selectedFile, setSelectedFile] = useState<File | null>(null);

	const [isDataChannelOpen, setIsDataChannelOpen] = useState(false);

	const [peerReady, setPeerReady] = useState(false);

	const [saveDirectory, setSaveDirectory] =
		useState<FileSystemDirectoryHandle | null>(null);

	const [activeTransfers, setActiveTransfers] = useState<
		Record<string, TransferState>
	>({});

	const [connectionStatus, setConnectionStatus] =
		useState<ConnectionStatus>("idle");

	/**
	 * These refs intentionally own mutable WebRTC
	 * state instead of React state.
	 *
	 * This prevents changes such as role/peerReady
	 * from recreating the RTCPeerConnection.
	 */
	const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

	const dataChannelRef = useRef<RTCDataChannel | null>(null);

	const roleRef = useRef<Role>(null);

	const peerReadyRef = useRef(false);

	const saveDirectoryRef = useRef<FileSystemDirectoryHandle | null>(null);

	const mountedRef = useRef(false);

	const remoteDescriptionSetRef = useRef(false);

	const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

	/**
	 * IMPORTANT:
	 *
	 * Every signaling operation is serialized.
	 */
	const signalingQueueRef = useRef(Promise.resolve());

	/**
	 * TransferManager is deliberately created once.
	 */
	const transferManagerRef = useRef<TransferManager | null>(null);

	/**
	 * Keep refs synchronized with React state.
	 */
	useEffect(() => {
		roleRef.current = role;
	}, [role]);

	useEffect(() => {
		peerReadyRef.current = peerReady;
	}, [peerReady]);

	/**
	 * Transfer state update.
	 */
	const updateTransfer = useCallback(
		(transferId: string, update: Partial<TransferState>) => {
			setActiveTransfers((current) => {
				const existing = current[transferId];

				return {
					...current,

					[transferId]: {
						...(existing ?? {
							fileName: "",
							totalBytes: 0,
							transferredBytes: 0,
							direction: "sending",
							status: "active",
						}),
						...update,
					},
				};
			});
		},
		[],
	);

	const ensureTransferManager = useCallback(() => {
		if (!transferManagerRef.current) {
			transferManagerRef.current = new TransferManager({
				getDataChannel: () => dataChannelRef.current,

				getSaveDirectory: () => saveDirectoryRef.current,

				updateTransfer,

				addMessage: (text) => {
					setMessages((current) => [...current, text]);
				},

				setStatus,

				setError,

				setPeerReady: (ready) => {
					peerReadyRef.current = ready;

					setPeerReady(ready);
				},
			});
		}

		return transferManagerRef.current;
	}, [updateTransfer]);

	const resetSession = useCallback(
		(reason?: string) => {
			const transferManager = ensureTransferManager();

			dataChannelRef.current?.close();
			dataChannelRef.current = null;

			peerConnectionRef.current?.close();
			peerConnectionRef.current = null;

			remoteDescriptionSetRef.current = false;
			pendingIceCandidatesRef.current = [];

			transferManager.destroy();

			setIsDataChannelOpen(false);
			setPeerReady(false);
			setConnectionStatus("disconnected");
			setStatus(reason ?? "Connection lost. Reconnect to continue.");
			setError(
				reason ?? "Connection closed unexpectedly. Please reconnect and retry.",
			);
			setActiveTransfers({});
		},
		[ensureTransferManager],
	);

	const handleResetSession = useCallback(() => {
		const transferManager = ensureTransferManager();

		dataChannelRef.current?.close();
		dataChannelRef.current = null;

		peerConnectionRef.current?.close();
		peerConnectionRef.current = null;

		remoteDescriptionSetRef.current = false;
		pendingIceCandidatesRef.current = [];

		transferManager.destroy();
		transferManagerRef.current = null;

		setMessage("");
		setJoinCode("");
		setRoomCode("");
		setStatus("Ready to connect");
		setError("");
		setRole(null);
		roleRef.current = null;
		setMessages([]);
		setSelectedFile(null);
		setIsDataChannelOpen(false);
		setPeerReady(false);
		peerReadyRef.current = false;
		setSaveDirectory(null);
		saveDirectoryRef.current = null;
		setActiveTransfers({});
		setConnectionStatus("idle");
	}, [ensureTransferManager]);

	/**
	 * Send a control message.
	 */
	/**
	 * IMPORTANT:
	 *
	 * This callback does NOT depend on role.
	 *
	 * That prevents the main WebRTC effect from
	 * being recreated when role changes.
	 */
	const connectDataChannel = useCallback(
		(channel: RTCDataChannel) => {
			/**
			 * Ignore a stale channel if another
			 * channel is already active.
			 */
			const existing = dataChannelRef.current;

			if (existing && existing !== channel) {
				console.warn("Closing stale DataChannel before connecting a new one.");

				existing.close();
			}

			if (dataChannelRef.current && dataChannelRef.current !== channel) {
				console.warn("Ignoring a second DataChannel event on a stale channel.");

				channel.close();

				return;
			}

			dataChannelRef.current = channel;

			channel.binaryType = "arraybuffer";

			channel.onopen = () => {
				if (dataChannelRef.current !== channel) {
					console.warn("Ignoring stale DataChannel open event.");

					return;
				}

				ensureTransferManager();

				console.log("DataChannel opened.");

				setIsDataChannelOpen(true);

				setConnectionStatus("connected");

				setStatus("WebRTC connection established.");

				/**
				 * Read role from ref, not React
				 * state.
				 */
				if (roleRef.current === "receiver") {
					ensureTransferManager().sendReceiverReady();

					peerReadyRef.current = true;

					setPeerReady(true);

					setStatus("Ready to receive files.");
				}
			};

			channel.onclose = () => {
				if (dataChannelRef.current !== channel) {
					console.warn("Ignoring stale DataChannel close event.");

					return;
				}

				console.log("DataChannel closed.");

				if (dataChannelRef.current === channel) {
					dataChannelRef.current = null;
				}

				setIsDataChannelOpen(false);

				peerReadyRef.current = false;

				setPeerReady(false);

				setConnectionStatus("disconnected");

				setStatus("Connection lost. Reconnect to continue.");
			};

			channel.onerror = (event) => {
				if (dataChannelRef.current !== channel) {
					console.warn("Ignoring stale DataChannel error event.");

					return;
				}

				console.error("DataChannel error:", event);

				if (
					channel.readyState === "closed" ||
					channel.readyState === "closing"
				) {
					return;
				}

				const error = event instanceof ErrorEvent ? event.error : event;

				if (
					error instanceof DOMException &&
					(error.name === "OperationError" ||
						error.name === "InvalidStateError")
				) {
					console.warn(
						"DataChannel send pressure exceeded; waiting for backpressure drain.",
					);

					return;
				}

				resetSession(
					"Connection closed unexpectedly. Please reconnect and retry.",
				);
			};

			channel.onmessage = (event) => {
				if (dataChannelRef.current !== channel) {
					console.warn("Ignoring stale DataChannel message event.");

					return;
				}

				const data = event.data;
				const manager = ensureTransferManager();

				if (isBinaryChunk(data)) {
					manager.enqueueIncomingMessage(data);

					return;
				}

				if (typeof data !== "string") {
					console.warn("Unsupported DataChannel message.");

					return;
				}

				try {
					const control = parseControlMessage(data);

					manager.enqueueIncomingMessage(control);
				} catch (error) {
					console.error("Invalid control message:", error);

					setError("Received invalid data from peer.");
				}
			};
		},
		[ensureTransferManager],
	);

	/**
	 * Create RTCPeerConnection.
	 *
	 * This callback is stable.
	 */
	const ensurePeerConnection = useCallback(() => {
		const existing = peerConnectionRef.current;

		if (existing && existing.signalingState !== "closed") {
			return existing;
		}

		const peerConnection = new RTCPeerConnection({
			iceServers: STUN_SERVER
				? [
						{
							urls: STUN_SERVER,
						},
					]
				: [],
		});

		remoteDescriptionSetRef.current = false;

		pendingIceCandidatesRef.current = [];

		peerConnection.onicecandidate = (event) => {
			if (!event.candidate) {
				return;
			}

			/**
			 * Ignore candidates from a stale
			 * peer connection.
			 */
			if (peerConnectionRef.current !== peerConnection) {
				return;
			}

			relayMessage({
				type: "ice-candidate",
				candidate: event.candidate.toJSON(),
			});
		};

		peerConnection.ondatachannel = (event) => {
			console.log("Remote DataChannel:", event.channel.label);

			connectDataChannel(event.channel);
		};

		peerConnection.oniceconnectionstatechange = () => {
			console.log("ICE state:", peerConnection.iceConnectionState);
		};

		peerConnection.onconnectionstatechange = () => {
			const state = peerConnection.connectionState;

			console.log("Peer connection:", state);

			if (state === "connected") {
				setConnectionStatus("connected");

				setStatus("Connected");
			}

			if (state === "connecting" || state === "new") {
				setConnectionStatus("connecting");
			}

			if (state === "disconnected") {
				setConnectionStatus("disconnected");

				setIsDataChannelOpen(false);
			}

			if (state === "failed") {
				setConnectionStatus("disconnected");

				setIsDataChannelOpen(false);

				peerReadyRef.current = false;

				setPeerReady(false);

				resetSession("Connection failed. Please reconnect and retry.");
			}
		};

		peerConnectionRef.current = peerConnection;

		return peerConnection;
	}, [connectDataChannel]);

	/**
	 * Flush ICE candidates after remote description
	 * exists.
	 */
	const flushPendingIceCandidates = useCallback(
		async (peerConnection: RTCPeerConnection) => {
			if (!remoteDescriptionSetRef.current) {
				return;
			}

			const candidates = pendingIceCandidatesRef.current;

			pendingIceCandidatesRef.current = [];

			for (const candidate of candidates) {
				if (peerConnection.signalingState === "closed") {
					return;
				}

				if (peerConnectionRef.current !== peerConnection) {
					return;
				}

				try {
					await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
				} catch (error) {
					console.error("Failed to add ICE candidate:", error);
				}
			}
		},
		[],
	);

	/**
	 * Create sender offer.
	 */
	const createOffer = useCallback(async (peerConnection: RTCPeerConnection) => {
		if (peerConnectionRef.current !== peerConnection) {
			return;
		}

		const offer = await peerConnection.createOffer();

		await peerConnection.setLocalDescription(offer);

		/**
		 * Send the actual local description.
		 */
		if (peerConnection.localDescription) {
			relayMessage({
				type: "offer",
				offer: peerConnection.localDescription,
			});
		}
	}, []);

	/**
	 * WebRTC + Socket lifecycle.
	 *
	 * Notice:
	 *
	 * role is NOT in this dependency array.
	 *
	 * This effect should not be destroyed/recreated
	 * just because React changed role.
	 */
	useEffect(() => {
		mountedRef.current = true;

		const unsubscribeCreated = subscribeToRoomCreated((event) => {
			roleRef.current = "sender";

			setRole("sender");

			setRoomCode(event.code);

			setStatus(`Room created: ${event.code}`);

			setError("");

			setConnectionStatus("waiting");
		});

		const unsubscribeJoined = subscribeToRoomJoined((event) => {
			const nextRole = event.role ?? null;

			roleRef.current = nextRole;

			setRole(nextRole);

			setRoomCode(event.code);

			setError("");

			setStatus("Pairing successful. Connecting...");

			setConnectionStatus("connecting");

			const peerConnection = ensurePeerConnection();

			/**
			 * Only sender creates the DataChannel.
			 */
			if (nextRole === "sender") {
				if (dataChannelRef.current) {
					dataChannelRef.current.close();
					dataChannelRef.current = null;
				}

				const channel = peerConnection.createDataChannel("fileTransfer", {
					ordered: false,
				});

				connectDataChannel(channel);

				signalingQueueRef.current = signalingQueueRef.current
					.then(() => createOffer(peerConnection))
					.catch((error) => {
						console.error("Offer creation failed:", error);

						setError("Failed to establish WebRTC connection.");
					});
			}
		});

		const unsubscribeError = subscribeToRoomError((event) => {
			setError(event.message);

			setStatus("Room request rejected");
		});

		const unsubscribeExpired = subscribeToRoomExpired((event) => {
			console.log("Room expired:", event.code);

			setError(event.message);

			setStatus(`Session ended: ${event.code}`);

			roleRef.current = null;

			peerReadyRef.current = false;

			setRole(null);

			setRoomCode("");

			setPeerReady(false);

			setIsDataChannelOpen(false);

			dataChannelRef.current?.close();

			dataChannelRef.current = null;

			peerConnectionRef.current?.close();

			peerConnectionRef.current = null;

			remoteDescriptionSetRef.current = false;

			pendingIceCandidatesRef.current = [];

			ensureTransferManager().destroy();

			setActiveTransfers({});
		});

		const unsubscribeRelay = subscribeToRelayMessage((payload) => {
			const signal = payload as {
				type?: string;
				offer?: RTCSessionDescriptionInit;
				answer?: RTCSessionDescriptionInit;
				candidate?: RTCIceCandidateInit;
			};

			signalingQueueRef.current = signalingQueueRef.current
				.then(async () => {
					const peerConnection = ensurePeerConnection();

					/**
					 * Ignore a peer connection that
					 * is no longer the active one.
					 */
					if (peerConnectionRef.current !== peerConnection) {
						return;
					}

					if (signal.type === "ice-candidate" && signal.candidate) {
						if (!remoteDescriptionSetRef.current) {
							pendingIceCandidatesRef.current.push(signal.candidate);

							return;
						}

						await peerConnection.addIceCandidate(
							new RTCIceCandidate(signal.candidate),
						);

						return;
					}

					if (signal.type === "offer" && signal.offer) {
						await peerConnection.setRemoteDescription(
							new RTCSessionDescription(signal.offer),
						);

						remoteDescriptionSetRef.current = true;

						await flushPendingIceCandidates(peerConnection);

						const answer = await peerConnection.createAnswer();

						await peerConnection.setLocalDescription(answer);

						if (peerConnection.localDescription) {
							relayMessage({
								type: "answer",
								answer: peerConnection.localDescription,
							});
						}

						return;
					}

					if (signal.type === "answer" && signal.answer) {
						await peerConnection.setRemoteDescription(
							new RTCSessionDescription(signal.answer),
						);

						remoteDescriptionSetRef.current = true;

						await flushPendingIceCandidates(peerConnection);
					}
				})
				.catch((error) => {
					console.error("WebRTC signaling error:", error);

					/**
					 * Do not show stale-PC errors as
					 * application errors.
					 */
					if (
						error instanceof DOMException &&
						error.name === "InvalidStateError"
					) {
						return;
					}

					setError(
						error instanceof Error
							? error.message
							: "WebRTC connection failed.",
					);
				});
		});

		return () => {
			mountedRef.current = false;

			unsubscribeCreated();
			unsubscribeJoined();
			unsubscribeError();
			unsubscribeExpired();
			unsubscribeRelay();

			ensureTransferManager().destroy();

			dataChannelRef.current?.close();

			dataChannelRef.current = null;

			peerConnectionRef.current?.close();

			peerConnectionRef.current = null;

			remoteDescriptionSetRef.current = false;

			pendingIceCandidatesRef.current = [];
		};
	}, [
		connectDataChannel,
		createOffer,
		ensurePeerConnection,
		ensureTransferManager,
		flushPendingIceCandidates,
	]);

	/**
	 * Save-directory selection.
	 */
	const handleSelectSaveDirectory = useCallback(async (): Promise<boolean> => {
		setError("");
		saveDirectoryRef.current = null;
		setSaveDirectory(null);
		setStatus("Files will be saved to your browser's Downloads folder.");

		const channel = dataChannelRef.current;

		if (channel?.readyState === "open") {
			ensureTransferManager().sendReceiverReady();

			peerReadyRef.current = true;

			setPeerReady(true);

			setStatus("Ready to receive files.");
		}

		return true;
	}, [ensureTransferManager]);

	/**
	 * Chat.
	 */
	const handleSend = useCallback(() => {
		const text = message.trim();

		if (!text) {
			return;
		}

		const sent = ensureTransferManager().sendChat(text);

		if (!sent) {
			setError("Connect to a peer before sending a message.");

			return;
		}

		setMessages((current) => [...current, `You: ${text}`]);

		setMessage("");

		setError("");
	}, [ensureTransferManager, message]);

	/**
	 * Create room.
	 */
	const handleCreateRoom = useCallback(() => {
		createRoom();
	}, []);

	/**
	 * Join room.
	 */
	const handleJoinRoom = useCallback(() => {
		const code = joinCode.trim();

		if (!code) {
			setError("Enter a room code.");

			return;
		}

		joinRoom(code);
	}, [joinCode]);

	/**
	 * Select a file.
	 */
	const handleSelectFile = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			const files = Array.from(event.target.files ?? []);
			const file = files[0] ?? null;

			event.target.value = "";

			setSelectedFile(file);

			setError("");

			if (file) {
				setStatus(`Selected ${file.name}`);
			}
		},
		[],
	);

	/**
	 * Send one file.
	 */
	const sendFile = useCallback(
		async (file: File) => {
			if (
				!dataChannelRef.current ||
				dataChannelRef.current.readyState !== "open"
			) {
				throw new Error("Data channel is not open.");
			}

			if (!peerReadyRef.current) {
				throw new Error("Receiver is not ready.");
			}

			await ensureTransferManager().sendFile(file);
		},
		[ensureTransferManager],
	);

	/**
	 * UI send handler.
	 */
	const handleSendFile = useCallback(async () => {
		if (!selectedFile) {
			setError("Choose a file before sending.");

			return;
		}

		try {
			await sendFile(selectedFile);

			setSelectedFile(null);
		} catch (error) {
			console.error("Send failed:", error);

			setError(error instanceof Error ? error.message : "Failed to send file.");
		}
	}, [selectedFile, sendFile]);

	/**
	 * True parallel transfers.
	 */
	const handleSendMultipleFiles = useCallback(
		async (files: File[]) => {
			if (files.length === 0) {
				return;
			}

			const results = await Promise.allSettled(
				files.map((file) => sendFile(file)),
			);

			const failed = results.filter((result) => result.status === "rejected");

			if (failed.length > 0) {
				setError(
					`${failed.length} file transfer${
						failed.length === 1 ? "" : "s"
					} failed.`,
				);
			}
		},
		[sendFile],
	);

	const transferList = Object.entries(activeTransfers).map(
		([transferId, transfer]) => ({
			transferId,
			...transfer,
		}),
	);

	return {
		message,
		setMessage,

		joinCode,
		setJoinCode,

		roomCode,

		status,
		error,

		role,

		messages,

		selectedFile,

		isConnected: isDataChannelOpen,

		connectionStatus,

		peerReady,

		saveDirectorySelected: Boolean(saveDirectory),

		chooseSaveDirectory: handleSelectSaveDirectory,

		activeTransfers: transferList,

		handleCreateRoom,
		handleJoinRoom,
		handleResetSession,

		handleSend,

		handleSelectFile,

		handleSendFile,

		handleSendMultipleFiles,
	};
}
