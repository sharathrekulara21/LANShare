import {
	FaCloudArrowUp,
	FaFile,
	FaFolderOpen,
	FaPaperPlane,
	FaShareNodes,
} from "react-icons/fa6";
import { SectionHeader } from "./SectionHeader";
import { formatBytes } from "../services/socket";

export function FileTransferPanel({
	role,
	isConnected,
	peerReady,
	selectedFile,
	handleSelectFile,
	handleSendFile,
}: {
	role: "sender" | "receiver" | null;
	isConnected: boolean;
	peerReady: boolean;
	selectedFile: File | null;
	handleSelectFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
	handleSendFile: () => void;
}) {
	const canSend = isConnected && peerReady && Boolean(selectedFile);

	return (
		<section className='rounded-2xl border border-gray-200 bg-white p-5 shadow-sm'>
			<SectionHeader
				icon={<FaShareNodes className='text-xs' />}
				title='File transfer'
				description='Send files to or receive files from the connected device.'
				right={
					<div
						className={`hidden rounded-full px-2.5 py-1 text-[10px] font-medium sm:block ${
							!isConnected
								? "bg-gray-100 text-gray-500"
								: !peerReady
									? "bg-amber-50 text-amber-700"
									: "bg-emerald-50 text-emerald-700"
						}`}
					>
						{!isConnected
							? "Not connected"
							: !peerReady
								? "Waiting for peer"
								: "Ready to transfer"}
					</div>
				}
			/>

			{/* Send files */}
			<label
				htmlFor='file-picker'
				className={`mt-5 flex min-h-[165px] touch-manipulation flex-col items-center justify-center rounded-xl border border-dashed px-5 py-8 text-center transition ${
					isConnected && peerReady
						? "cursor-pointer border-gray-300 bg-gray-50 hover:border-amber-400 hover:bg-amber-50/40 active:scale-[0.99]"
						: "cursor-not-allowed border-gray-200 bg-gray-50 opacity-60"
				}`}
			>
				<div className='flex h-12 w-12 items-center justify-center rounded-xl bg-white text-amber-500 shadow-sm'>
					<FaCloudArrowUp className='text-lg' />
				</div>

				<p className='mt-3 text-xs font-semibold text-gray-800'>Send a file</p>

				<p className='mt-1 text-[11px] text-gray-500'>
					Choose a file to send to the connected device
				</p>

				<div className='mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[10px] font-medium text-gray-600 shadow-sm'>
					<FaFolderOpen className='text-[9px] text-gray-400' />
					Browse files
				</div>

				<input
					id='file-picker'
					type='file'
					multiple={false}
					onChange={handleSelectFile}
					disabled={!isConnected || !peerReady}
					className='sr-only absolute h-px w-px overflow-hidden opacity-0'
				/>
			</label>

			{/* Selected file */}
			{selectedFile && (
				<div className='mt-3 flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3'>
					<div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-amber-500 shadow-sm'>
						<FaFile className='text-sm' />
					</div>

					<div className='min-w-0 flex-1'>
						<p className='truncate text-xs font-medium text-gray-800'>
							{selectedFile.name}
						</p>

						<p className='mt-0.5 text-[10px] text-gray-500'>
							{formatBytes(selectedFile.size)}
						</p>
					</div>

					<button
						type='button'
						onClick={handleSendFile}
						disabled={!canSend}
						className={`flex min-h-[44px] shrink-0 touch-manipulation items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-[10px] font-semibold transition ${
							canSend
								? "bg-gray-900 text-white hover:bg-gray-800 active:scale-[0.99]"
								: "cursor-not-allowed bg-gray-200 text-gray-400"
						}`}
					>
						<FaPaperPlane className='text-[9px]' />
						Send
					</button>
				</div>
			)}

			{/* Connection hint */}
			<div className='mt-3 flex items-center justify-between text-[10px] text-gray-400'>
				<span>
					{isConnected
						? peerReady
							? "Both devices can send files"
							: "Waiting for the other device"
						: "Connect to a device to start sharing"}
				</span>

				{role && (
					<span className='hidden sm:inline'>
						{role === "sender" ? "Room creator" : "Room participant"}
					</span>
				)}
			</div>
		</section>
	);
}
