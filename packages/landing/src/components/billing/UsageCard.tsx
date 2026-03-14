/**
 * UsageCard - Displays quota usage with progress bars
 */

import { useMemo } from 'react';
import { UsersIcon, FolderIcon, TrendingUpIcon } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface UsageMetricProps {
  label: string;
  icon: React.ReactNode;
  used: number;
  max: number;
}

function UsageMetric({ label, icon, used, max }: UsageMetricProps) {
  const isUnlimited = max === -1;
  const percentage = isUnlimited || max === 0 ? 0 : Math.min(100, Math.round((used / max) * 100));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">{icon}</div>
          <span className="text-secondary-foreground text-sm font-medium">{label}</span>
        </div>
        <span className="text-foreground text-sm font-semibold">
          {isUnlimited ? (
            <span className="text-emerald-600">Unlimited</span>
          ) : (
            `${used} / ${max}`
          )}
        </span>
      </div>
      {isUnlimited ? (
        <div className="h-2 w-full rounded-full bg-gradient-to-r from-emerald-100 to-emerald-200" />
      ) : (
        <Progress value={percentage} />
      )}
    </div>
  );
}

interface UsageCardProps {
  quotas: Record<string, number> | null;
  usage: { projects?: number; collaborators?: number } | null;
}

export function UsageCard({ quotas, usage }: UsageCardProps) {
  const metrics = useMemo(
    () => [
      {
        key: 'projects',
        label: 'Projects',
        icon: <FolderIcon className="text-muted-foreground h-4 w-4" />,
        used: usage?.projects ?? 0,
        max: quotas?.['projects.max'] ?? 0,
      },
      {
        key: 'collaborators',
        label: 'Team Members',
        icon: <UsersIcon className="text-muted-foreground h-4 w-4" />,
        used: usage?.collaborators ?? 0,
        max: quotas?.['collaborators.org.max'] ?? 0,
      },
    ],
    [quotas, usage],
  );

  const hasAnyQuota =
    quotas && (quotas['projects.max'] !== 0 || quotas['collaborators.org.max'] !== 0);

  return (
    <div className="border-border bg-card rounded-xl border p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-2">
        <TrendingUpIcon className="text-muted-foreground h-5 w-5" />
        <h3 className="text-foreground text-lg font-semibold">Usage</h3>
      </div>

      {hasAnyQuota ? (
        <div className="space-y-5">
          {metrics.map(
            metric =>
              (metric.max !== 0 || metric.used > 0) && (
                <UsageMetric
                  key={metric.key}
                  label={metric.label}
                  icon={metric.icon}
                  used={metric.used}
                  max={metric.max}
                />
              ),
          )}
        </div>
      ) : (
        <div className="py-6 text-center">
          <p className="text-muted-foreground text-sm">
            Upgrade to a paid plan to create projects and collaborate with your team.
          </p>
        </div>
      )}
    </div>
  );
}
