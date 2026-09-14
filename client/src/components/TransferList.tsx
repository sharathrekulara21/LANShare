import {
	FaArrowDown,
	FaArrowUp,
	FaCheck,
	FaServer,
	FaTriangleExclamation,
} from "react-icons/fa6";

import { SectionHeader } from "./SectionHeader";
import { formatBytes } from "../services/socket";

export function TransferList({
	transfers,
}: {
	transfers: Array<{
		transferId: string;
		fileName: string;
		totalBytes: number;
		transferredBytes: number;
		direction: "sending" | "receiving";
		status: "active" | "completed" | "failed";
	}>;
}) {
	if (transfers.length === 0) {
		return null;
	}

	const activeCount = transfers.filter(
		(transfer) => transfer.status === "active",
	).length;

	const completedCount = transfers.filter(
		(transfer) => transfer.status === "completed",
	).length;

	return (
		<section className='rounded-2xl border border-gray-200 bg-white p-5 shadow-sm'>
			<div className='flex items-center justify-between gap-4'>
				<SectionHeader
					icon={<FaServer className='text-xs' />}
					title='Transfers'
					description='Current and recent file activity.'
				/>

				<div className='shrink-0 text-right text-[10px] text-gray-400'>
					{activeCount > 0 && (
						<span className='font-medium text-amber-600'>
							{activeCount} active
						</span>
					)}

					{activeCount > 0 && completedCount > 0 && (
						<span className='mx-1'>·</span>
					)}

					{completedCount > 0 && <span>{completedCount} completed</span>}
				</div>
			</div>

			<div className='mt-4 space-y-2'>
				{transfers.map((transfer) => {
					const progress =
						transfer.totalBytes === 0
							? 100
							: Math.min(
									100,
									Math.round(
										(transfer.transferredBytes / transfer.totalBytes) * 100,
									),
								);

					const isCompleted = transfer.status === "completed";
					const isFailed = transfer.status === "failed";

					const statusLabel = isCompleted
						? "Complete"
						: isFailed
							? "Failed"
							: transfer.direction === "sending"
								? "Sending"
								: "Receiving";

					return (
						<div
							key={transfer.transferId}
							className='rounded-xl border border-gray-200 bg-gray-50 p-3'
						>
							<div className='flex items-center gap-3'>
								<div
									className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
										isCompleted
											? "bg-emerald-50 text-emerald-600"
											: isFailed
												? "bg-red-50 text-red-600"
												: "bg-amber-50 text-amber-600"
									}`}
								>
									{isCompleted ? (
										<FaCheck className='text-xs' />
									) : isFailed ? (
										<FaTriangleExclamation className='text-xs' />
									) : transfer.direction === "sending" ? (
										<FaArrowUp className='text-xs' />
									) : (
										<FaArrowDown className='text-xs' />
									)}
								</div>

								<div className='min-w-0 flex-1'>
									<div className='flex items-center justify-between gap-3'>
										<p className='truncate text-xs font-medium text-gray-800'>
											{transfer.fileName}
										</p>

										<span
											className={`shrink-0 text-[10px] font-medium ${
												isCompleted
													? "text-emerald-600"
													: isFailed
														? "text-red-600"
														: "text-amber-600"
											}`}
										>
											{statusLabel}
										</span>
									</div>

									<div className='mt-2 flex items-center gap-2'>
										<div className='h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200'>
											<div
												className={`h-full rounded-full transition-all ${
													isCompleted
														? "bg-emerald-500"
														: isFailed
															? "bg-red-500"
															: "bg-amber-500"
												}`}
												style={{ width: `${progress}%` }}
											/>
										</div>

										<span className='w-8 text-right text-[10px] font-medium text-gray-500'>
											{progress}%
										</span>
									</div>

									<div className='mt-1.5 flex items-center justify-between text-[9px] text-gray-400'>
										<span>
											{formatBytes(transfer.transferredBytes)} transferred
										</span>

										<span>{formatBytes(transfer.totalBytes)}</span>
									</div>
								</div>
							</div>
						</div>
					);
				})}
			</div>
		</section>
	);
}
