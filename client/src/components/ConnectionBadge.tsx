export function ConnectionBadge({
	isConnected,
	connectionStatus,
}: {
	isConnected: boolean;
	connectionStatus:
		| "idle"
		| "waiting"
		| "connecting"
		| "connected"
		| "disconnected";
}) {
	const label = isConnected
		? "Connected"
		: connectionStatus === "connecting"
			? "Connecting"
			: connectionStatus === "waiting"
				? "Waiting"
				: "Offline";

	const statusClass = isConnected
		? "bg-emerald-50 text-emerald-700 border-emerald-200"
		: connectionStatus === "connecting"
			? "bg-amber-50 text-amber-700 border-amber-200"
			: "bg-gray-50 text-gray-500 border-gray-200";

	const dotClass = isConnected
		? "bg-emerald-500"
		: connectionStatus === "connecting"
			? "bg-amber-500"
			: "bg-gray-400";

	return (
		<div
			className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5 ${statusClass}`}
		>
			<span
				className={`h-1.5 w-1.5 rounded-full ${dotClass} ${
					isConnected ? "animate-pulse" : ""
				}`}
			/>

			<span className='text-[11px] font-medium'>{label}</span>
		</div>
	);
}
