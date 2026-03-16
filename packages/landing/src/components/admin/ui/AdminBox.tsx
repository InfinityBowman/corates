/**
 * AdminBox - Consistent container component for admin UI
 */

interface AdminBoxProps {
  padding?: 'compact' | 'default' | 'spacious';
  className?: string;
  children: React.ReactNode;
}

const PADDING_CLASSES = {
  compact: 'p-4',
  default: 'p-6',
  spacious: 'p-8',
} as const;

export function AdminBox({ padding = 'default', className = '', children }: AdminBoxProps) {
  return (
    <div className={`border-border bg-card rounded-xl border shadow-xs ${PADDING_CLASSES[padding]} ${className}`}>
      {children}
    </div>
  );
}
