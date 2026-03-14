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
  study: <FileTextIcon className="h-4 w-4" />,
  project: <FolderIcon className="h-4 w-4" />,
  complete: <CheckIcon className="h-4 w-4" />,
  user: <UserIcon className="h-4 w-4" />,
};

const BG_MAP: Record<string, string> = {
  study: 'bg-blue-100 text-primary',
  project: 'bg-amber-100 text-amber-600',
  complete: 'bg-emerald-100 text-emerald-600',
  user: 'bg-violet-100 text-violet-600',
};

function ActivityIcon({ type }: { type: string }) {
  return (
    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${BG_MAP[type] || 'bg-secondary text-secondary-foreground'}`}>
      {ICON_MAP[type] || <ClockIcon className="h-4 w-4" />}
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
    <div className="rounded-xl border border-border/60 bg-card p-5" style={animation.fadeUp(500)}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Recent Activity
        </h3>
        {onViewAll && activities.length > limit && (
          <button
            type="button"
            onClick={onViewAll}
            className="text-xs font-medium text-primary hover:text-primary/80"
          >
            View all
          </button>
        )}
      </div>

      {displayActivities.length > 0 ? (
        <div className="divide-y divide-border">
          {displayActivities.map((activity) => (
            <div key={`${activity.title}-${activity.timestamp}`} className="flex items-start gap-3 py-3">
              <ActivityIcon type={activity.type} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-secondary-foreground">
                  <span className="font-medium">{activity.title}</span>
                  {activity.subtitle && (
                    <span className="text-muted-foreground"> {activity.subtitle}</span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground/70">
                  {formatRelativeTime(activity.timestamp)}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
            <ClockIcon className="h-5 w-5 text-muted-foreground/70" />
          </div>
          <p className="text-sm text-muted-foreground">No recent activity</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Your activity will appear here as you work
          </p>
        </div>
      )}
    </div>
  );
}
