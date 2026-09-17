export function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className='rounded-lg bg-gray-50 p-6'>
      {/* Body spans the full card width on mobile (below the icon row) and
          stays aligned with the title on larger screens */}
      <div className='grid grid-cols-[auto_1fr] items-center gap-x-4'>
        <div className='flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-100'>
          <Icon className='size-5 text-blue-600' />
        </div>
        <h2 className='text-lg font-semibold text-gray-900'>{title}</h2>
        <div className='col-span-2 mt-2 min-w-0 sm:col-span-1 sm:col-start-2'>{children}</div>
      </div>
    </div>
  );
}
