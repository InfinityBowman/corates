/**
 * Stats Card component for admin dashboard
 * Displays a single statistic with icon and optional loading state
 */

import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const colorMap: Record<string, { bg: string; icon: string; text: string }> = {
  blue: {
    bg: 'bg-blue-50',
    icon: 'bg-blue-100 text-blue-600',
    text: 'text-blue-600',
  },
  green: {
    bg: 'bg-success-bg',
    icon: 'bg-success-bg text-success',
    text: 'text-success',
  },
  purple: {
    bg: 'bg-purple-50',
    icon: 'bg-purple-100 text-purple-600',
    text: 'text-purple-600',
  },
  orange: {
    bg: 'bg-orange-50',
    icon: 'bg-orange-100 text-orange-600',
    text: 'text-orange-600',
  },
};

interface StatsCardProps {
  title: string;
  value: number | string;
  color: 'blue' | 'green' | 'purple' | 'orange';
  icon: LucideIcon;
  loading?: boolean;
}

export function StatsCard({ title, value, color, icon: Icon, loading }: StatsCardProps) {
  const colors = colorMap[color] || colorMap.blue;

  return (
    <Card className={`rounded-lg p-5 ${colors.bg}`}>
      <CardContent className='p-0'>
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
      </CardContent>
    </Card>
  );
}
