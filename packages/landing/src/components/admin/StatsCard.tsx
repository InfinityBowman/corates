/**
 * Stats Card component for admin dashboard
 * Displays a single statistic with icon and optional loading state
 */

import type { LucideIcon } from 'lucide-react';

const colorMap: Record<string, { bg: string; icon: string; text: string }> = {
  blue: {
    bg: 'bg-blue-50',
    icon: 'bg-blue-100 text-blue-600',
    text: 'text-blue-600',
  },
  green: {
    bg: 'bg-green-50',
    icon: 'bg-green-100 text-green-600',
    text: 'text-green-600',
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
    <div className={`border-border rounded-lg border p-5 ${colors.bg}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground text-sm font-medium">{title}</p>
          {loading ? (
            <div className="bg-secondary mt-1 h-8 w-16 animate-pulse rounded" />
          ) : (
            <p className={`mt-1 text-2xl font-bold ${colors.text}`}>{value}</p>
          )}
        </div>
        <div className={`rounded-lg p-3 ${colors.icon}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}
