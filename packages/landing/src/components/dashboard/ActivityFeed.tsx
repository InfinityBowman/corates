/**
 * ActivityFeed - Shows recent activity across projects
 */

import { useMemo } from 'react';
import { ClockIcon, FileTextIcon, FolderIcon, CheckIcon, UserIcon } from 'lucide-react';
import { useAnimation } from './useInitialAnimation';
import { formatRelativeTime } from './utils';

interface Activity {
  type: string;
  title: string;
  subtitle?: string;
  timestamp: Date | string | number;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  study: <FileTextIcon className='size-4' />,
  project: <FolderIcon className='size-4' />,
  complete: <CheckIcon className='size-4' />,
  user: <UserIcon className='size-4' />,
};

const BG_MAP: Record<string, string> = {
  study: 'bg-blue-100 text-primary',
  project: 'bg-amber-100 text-amber-600',
  complete: 'bg-emerald-100 text-emerald-600',
  user: 'bg-violet-100 text-violet-600',
};

function ActivityIcon({ type }: { type: string }) {
  return (
    <div
      className={`flex size-8 shrink-0 items-center justify-center rounded-full ${BG_MAP[type] || 'bg-secondary text-secondary-foreground'}`}
    >
      {ICON_MAP[type] || <ClockIcon className='size-4' />}
    </div>
  );
}

interface ActivityFeedProps {
  activities: Activity[];
  limit?: number;
  onViewAll?: () => void;
}

export function ActivityFeed({ activities = [], limit = 5, onViewAll }: ActivityFeedProps) {
  const animation = useAnimation();

  const displayActivities = useMemo(() => activities.slice(0, limit), [activities, limit]);

  return (
    <div className='border-border/60 bg-card rounded-xl border p-5' style={animation.fadeUp(500)}>
      <div className='mb-2 flex items-center justify-between'>
        <h3 className='text-muted-foreground text-sm font-semibold tracking-wide uppercase'>
          Recent Activity
        </h3>
        {onViewAll && activities.length > limit && (
          <button
            type='button'
            onClick={onViewAll}
            className='text-primary hover:text-primary/80 text-xs font-medium'
          >
            View all
          </button>
        )}
      </div>

      {displayActivities.length > 0 ?
        <div className='divide-border divide-y'>
          {displayActivities.map(activity => (
            <div
              key={`${activity.title}-${activity.timestamp}`}
              className='flex items-start gap-3 py-3'
            >
              <ActivityIcon type={activity.type} />
              <div className='min-w-0 flex-1'>
                <p className='text-secondary-foreground text-sm'>
                  <span className='font-medium'>{activity.title}</span>
                  {activity.subtitle && (
                    <span className='text-muted-foreground'> {activity.subtitle}</span>
                  )}
                </p>
                <p className='text-muted-foreground/70 mt-0.5 text-xs'>
                  {formatRelativeTime(activity.timestamp)}
                </p>
              </div>
            </div>
          ))}
        </div>
      : <div className='py-8 text-center'>
          <div className='bg-secondary mx-auto mb-3 flex size-12 items-center justify-center rounded-full'>
            <ClockIcon className='text-muted-foreground/70 size-5' />
          </div>
          <p className='text-muted-foreground text-sm'>No recent activity</p>
          <p className='text-muted-foreground/70 mt-1 text-xs'>
            Your activity will appear here as you work
          </p>
        </div>
      }
    </div>
  );
}
