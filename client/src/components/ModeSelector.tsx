import { FaCloudArrowUp, FaLink, FaShareNodes } from "react-icons/fa6";
import { SectionHeader } from "./SectionHeader";

export function ModeSelector({
	joinCode,
	setJoinCode,
	handleCreateRoom,
	handleJoinRoom,
}: {
	joinCode: string;
	setJoinCode: (value: string) => void;
	handleCreateRoom: () => void;
	handleJoinRoom: () => void;
}) {
	return (
		<section className='rounded-2xl border border-gray-200 bg-white p-5 shadow-sm'>
			<SectionHeader
				icon={<FaShareNodes className='text-xs' />}
				title='Start sharing'
				description='Create a room or join an existing one.'
			/>

			<div className='mt-5 grid gap-3 sm:grid-cols-2'>
				<button
					type='button'
					onClick={handleCreateRoom}
					className='group flex min-h-[108px] cursor-pointer flex-col justify-between rounded-xl border border-amber-500 bg-amber-500 p-4 text-left transition hover:bg-amber-600'
				>
					<div className='flex items-center justify-between'>
						<div className='flex h-9 w-9 items-center justify-center rounded-lg bg-white/20 text-white'>
							<FaCloudArrowUp className='text-sm' />
						</div>
					</div>

					<div>
						<p className='text-sm font-semibold text-white'>Send files</p>

						<p className='mt-0.5 text-[11px] text-amber-950/70'>
							Create a room and share the code.
						</p>
					</div>
				</button>

				<div className='min-h-[108px] rounded-xl border border-gray-200 bg-gray-50 p-3'>
					<div className='flex h-full flex-col justify-between'>
						<div className='flex items-center gap-2'>
							<div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-gray-500 shadow-sm'>
								<FaLink className='text-xs' />
							</div>

							<div>
								<p className='text-sm font-semibold text-gray-800'>
									Join a room
								</p>

								<p className='text-[10px] text-gray-500'>
									Enter a code to receive files.
								</p>
							</div>
						</div>

						<div className='mt-3 flex items-center gap-2'>
							<input
								value={joinCode}
								onChange={(event) => setJoinCode(event.target.value)}
								onKeyDown={(event) => {
									if (event.key === "Enter") {
										handleJoinRoom();
									}
								}}
								placeholder='Room code'
								autoComplete='off'
								className='min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 font-mono text-xs uppercase tracking-widest text-gray-800 outline-none transition placeholder:font-sans placeholder:normal-case placeholder:tracking-normal focus:border-amber-400 focus:ring-2 focus:ring-amber-100'
							/>

							<button
								type='button'
								onClick={handleJoinRoom}
								className='flex h-9 cursor-pointer shrink-0 items-center gap-1.5 rounded-lg bg-gray-900 px-3 text-[10px] font-semibold text-white transition hover:bg-gray-800'
							>
								Join
							</button>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
