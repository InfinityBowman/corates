import type { LucideIcon } from 'lucide-react';

type IconColor = 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'gray';

interface DashboardHeaderProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  iconColor?: IconColor;
}

const ICON_COLOR_CLASSES: Record<IconColor, string> = {
  blue: 'bg-info-bg text-info',
  green: 'bg-success-bg text-success',
  purple: 'bg-chart-cat-5/15 text-chart-cat-5',
  orange: 'bg-warning-bg text-warning',
  red: 'bg-destructive-bg text-destructive',
  gray: 'bg-secondary text-muted-foreground',
};

export function DashboardHeader({
  icon: Icon,
  title,
  description,
  actions,
  iconColor = 'blue',
}: DashboardHeaderProps) {
  return (
    <div className='flex items-center justify-between'>
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
