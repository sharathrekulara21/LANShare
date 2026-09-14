export function SectionHeader({
	icon,
	title,
	description,
	right,
}: {
	icon: React.ReactNode;
	title: string;
	description?: string;
	right?: React.ReactNode;
}) {
	return (
		<div className='flex items-start justify-between gap-4'>
			<div className='flex items-start gap-3'>
				<div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500'>
					{icon}
				</div>

				<div>
					<h2 className='text-sm font-semibold text-gray-900'>{title}</h2>

					{description && (
						<p className='mt-0.5 text-[11px] leading-4 text-gray-500'>
							{description}
						</p>
					)}
				</div>
			</div>

			{right}
		</div>
	);
}
