/**
 * DashboardHeader - Consistent page header for admin views
 */

import type { LucideIcon } from 'lucide-react';

type IconColor = 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'gray';

interface DashboardHeaderProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  iconColor?: IconColor;
  className?: string;
}

const ICON_COLOR_CLASSES: Record<IconColor, string> = {
  blue: 'bg-blue-100 text-blue-600',
  green: 'bg-green-100 text-green-600',
  purple: 'bg-purple-100 text-purple-600',
  orange: 'bg-orange-100 text-orange-600',
  red: 'bg-red-100 text-red-600',
  gray: 'bg-secondary text-muted-foreground',
};

export function DashboardHeader({
  icon: Icon,
  title,
  description,
  actions,
  iconColor = 'blue',
  className = '',
}: DashboardHeaderProps) {
  return (
    <div className={`mb-8 flex items-center justify-between ${className}`}>
      <div className='flex items-center gap-3'>
        {Icon && (
          <div className={`rounded-xl p-2.5 ${ICON_COLOR_CLASSES[iconColor]}`}>
            <Icon className='size-6' />
          </div>
        )}
        <div>
          <h1 className='text-foreground text-2xl font-bold'>{title}</h1>
          {description && <p className='text-muted-foreground text-sm'>{description}</p>}
        </div>
      </div>
      {actions && <div className='flex items-center gap-3'>{actions}</div>}
    </div>
  );
}
