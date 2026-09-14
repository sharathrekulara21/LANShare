import { useState } from "react";
import { FaCircleExclamation, FaCopy, FaLink, FaSignal } from "react-icons/fa6";

export function StatusCard({
	status,
	error,
	roomCode,
	role,
}: {
	status: string;
	error: string;
	roomCode: string;
	role: "sender" | "receiver" | null;
}) {
	const [copied, setCopied] = useState(false);

	if (!status && !error && !roomCode) {
		return null;
	}

	const handleCopyRoomCode = async () => {
		if (!roomCode) {
			return;
		}

		try {
			await navigator.clipboard.writeText(roomCode);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1500);
		} catch {
			setCopied(false);
		}
	};

	return (
		<div
			className={`rounded-xl border px-4 py-3 ${
				error ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"
			}`}
		>
			<div className='flex items-center justify-between gap-4'>
				<div className='flex min-w-0 items-center gap-3'>
					<div
						className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
							error ? "bg-red-100 text-red-600" : "bg-amber-50 text-amber-600"
						}`}
					>
						{error ? (
							<FaCircleExclamation className='text-sm' />
						) : (
							<FaSignal className='text-sm' />
						)}
					</div>

					<div className='min-w-0'>
						<p className='text-[10px] font-medium uppercase tracking-wider text-gray-400'>
							Session
						</p>

						<p
							className={`mt-0.5 truncate text-xs font-medium ${
								error ? "text-red-700" : "text-gray-700"
							}`}
						>
							{error || status}
						</p>
					</div>
				</div>

				{roomCode && (
					<div className='flex shrink-0 items-center gap-2'>
						<div className='hidden text-right sm:block'>
							<p className='text-[10px] text-gray-400'>
								{role === "receiver" ? "Joined room" : "Room code"}
							</p>

							<div className='flex items-center justify-end gap-2'>
								<p className='font-mono text-sm font-semibold tracking-widest text-gray-800'>
									{roomCode}
								</p>

								<div className='relative group'>
									<button
										type='button'
										onClick={handleCopyRoomCode}
										title={copied ? "Copied!" : "Copy room code"}
										className='flex cursor-pointer h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:border-amber-300 hover:text-amber-600'
									>
										<FaCopy className='text-[10px]' />
									</button>

									<span className='pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gray-900 px-2 py-1 text-[9px] font-medium text-white opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100'>
										{copied ? "Copied!" : "Copy room code"}
									</span>
								</div>
							</div>
						</div>

						<div className='relative group flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600 sm:hidden'>
							<FaLink className='text-xs' />
							<button
								type='button'
								onClick={handleCopyRoomCode}
								title={copied ? "Copied!" : "Copy room code"}
								className='absolute inset-0 h-full w-full rounded-lg'
								aria-label='Copy room code'
							/>
							<span className='pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gray-900 px-2 py-1 text-[9px] font-medium text-white opacity-0 transition group-hover:opacity-100'>
								{copied ? "Copied!" : "Copy room code"}
							</span>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
