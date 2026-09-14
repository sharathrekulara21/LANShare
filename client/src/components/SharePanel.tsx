import { ConnectionBadge } from "./ConnectionBadge";
import { StatusCard } from "./StatusCard";
import { FaRotate, FaShareNodes } from "react-icons/fa6";
import { useShareSession } from "../utils/useShareSession";
import { ModeSelector } from "./ModeSelector";
import { FileTransferPanel } from "./FunctionTransferPanel";
import { TransferList } from "./TransferList";

export function SharePanel() {
	const {
		joinCode,
		setJoinCode,
		roomCode,
		status,
		error,
		role,
		isConnected,
		connectionStatus,
		peerReady,
		selectedFile,
		activeTransfers,
		handleCreateRoom,
		handleJoinRoom,
		handleResetSession,
		handleSelectFile,
		handleSendFile,
	} = useShareSession();

	const showModeSelector = !role;

	return (
		<div className='min-h-screen bg-[#F7F7F5] px-4 py-6 text-gray-900'>
			<div className='mx-auto max-w-4xl'>
				<header className='flex items-center justify-between border-b border-gray-200 pb-4'>
					<div className='flex items-center gap-3'>
						<div className='flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm'>
							<FaShareNodes className='text-sm' />
						</div>

						<div>
							<h1 className='text-base font-semibold tracking-tight text-gray-900'>
								LAN Share
							</h1>

							<p className='mt-0.5 text-[10px] text-gray-500'>
								Direct file transfer over your local network
							</p>
						</div>
					</div>

					<div className='flex items-center gap-2'>
						<ConnectionBadge
							isConnected={isConnected}
							connectionStatus={connectionStatus}
						/>

						{role || roomCode ? (
							<button
								type='button'
								onClick={handleResetSession}
								title='Start a new sharing session'
								className='flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition hover:border-gray-300 hover:text-gray-800 sm:h-auto sm:w-auto sm:px-3 sm:py-1.5'
							>
								<FaRotate className='text-[10px]' />
								<span className='ml-1.5 hidden text-[10px] font-medium sm:inline'>
									New session
								</span>
							</button>
						) : null}
					</div>
				</header>

				<main className='mx-auto mt-5 max-w-3xl'>
					<StatusCard
						status={status}
						error={error}
						roomCode={roomCode}
						role={role}
					/>

					<div
						className={`${status || error || roomCode ? "mt-3" : ""} space-y-3`}
					>
						{showModeSelector ? (
							<ModeSelector
								joinCode={joinCode}
								setJoinCode={setJoinCode}
								handleCreateRoom={handleCreateRoom}
								handleJoinRoom={handleJoinRoom}
							/>
						) : (
							<>
								<FileTransferPanel
									role={role}
									isConnected={isConnected}
									peerReady={peerReady}
									selectedFile={selectedFile}
									handleSelectFile={handleSelectFile}
									handleSendFile={handleSendFile}
								/>

								<TransferList transfers={activeTransfers} />
							</>
						)}
					</div>
				</main>
			</div>
		</div>
	);
}
