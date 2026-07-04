import type { LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const colorMap = {
  blue: {
    bg: 'bg-info-bg',
    icon: 'bg-info-bg text-info',
    text: 'text-info',
  },
  green: {
    bg: 'bg-success-bg',
    icon: 'bg-success-bg text-success',
    text: 'text-success',
  },
  purple: {
    bg: 'bg-chart-cat-5/15',
    icon: 'bg-chart-cat-5/15 text-chart-cat-5',
    text: 'text-chart-cat-5',
  },
  orange: {
    bg: 'bg-warning-bg',
    icon: 'bg-warning-bg text-warning',
    text: 'text-warning',
  },
} as const;

interface StatsCardProps {
  title: string;
  value: number | string;
  color: keyof typeof colorMap;
  icon: LucideIcon;
  loading?: boolean;
}

export function StatsCard({ title, value, color, icon: Icon, loading }: StatsCardProps) {
  const colors = colorMap[color];

  return (
    <div className={`rounded-xl p-5 ${colors.bg}`}>
      <div className='flex items-center justify-between'>
        <div>
          <p className='text-muted-foreground text-sm font-medium'>{title}</p>
          {loading ?
            <Skeleton className='mt-1 h-8 w-16' />
          : <p className={`mt-1 text-2xl font-bold ${colors.text}`}>{value}</p>}
        </div>
        <div className={`rounded-lg p-3 ${colors.icon}`}>
          <Icon className='size-6' />
        </div>
      </div>
    </div>
  );
}
