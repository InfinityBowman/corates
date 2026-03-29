/**
 * DashboardBody - Main content wrapper for admin pages
 */

interface DashboardBodyProps {
  className?: string;
  children: React.ReactNode;
}

export function DashboardBody({ className = '', children }: DashboardBodyProps) {
  return (
    <div className={`flex h-full w-full flex-col px-4 py-6 md:px-6 lg:px-8 ${className}`}>
      {children}
    </div>
  );
}
