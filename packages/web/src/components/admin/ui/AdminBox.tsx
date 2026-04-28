import { cn } from '@/lib/utils';

interface AdminBoxProps {
  className?: string;
  children: React.ReactNode;
}

export function AdminBox({ className, children }: AdminBoxProps) {
  return (
    <div className={cn('border-border bg-card rounded-xl border p-6 shadow-xs', className)}>
      {children}
    </div>
  );
}
