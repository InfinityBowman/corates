/**
 * AdminSection - Section grouping component with header
 */

interface AdminSectionProps {
  title: string;
  description?: string;
  cta?: React.ReactNode;
  compact?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function AdminSection({
  title,
  description,
  cta,
  compact,
  className = '',
  children,
}: AdminSectionProps) {
  return (
    <div className={`flex flex-col ${compact ? 'gap-4' : 'gap-6'} ${className}`}>
      <div className='flex flex-col gap-1'>
        <div className='flex items-center justify-between'>
          <h2 className='text-foreground text-lg font-medium'>{title}</h2>
          {cta}
        </div>
        {description && <p className='text-muted-foreground text-sm'>{description}</p>}
      </div>
      {children}
    </div>
  );
}
