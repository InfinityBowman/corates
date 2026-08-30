/** The Usage section of the billing page. */

import { UsersIcon, FolderIcon, TrendingUpIcon } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { SettingsSection } from '@/components/settings/primitives';

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
    <div className='flex flex-col gap-2 px-4 py-3.5'>
      <div className='flex items-center justify-between gap-4'>
        <span className='text-foreground flex items-center gap-2 text-sm font-medium'>
          {icon}
          {label}
        </span>
        <span className='text-sm font-medium tabular-nums'>
          {isUnlimited ?
            <span className='text-success'>Unlimited</span>
          : <span className='text-foreground'>
              {used} <span className='text-muted-foreground font-normal'>of {max}</span>
            </span>
          }
        </span>
      </div>
      {isUnlimited ?
        <div className='from-success/20 to-success/40 h-2 w-full rounded-full bg-gradient-to-r' />
      : <Progress value={percentage} />}
    </div>
  );
}

interface UsageCardProps {
  quotas: Record<string, number> | null;
  usage: { projects?: number; collaborators?: number } | null;
}

export function UsageCard({ quotas, usage }: UsageCardProps) {
  const metrics = [
    {
      key: 'projects',
      label: 'Projects',
      icon: <FolderIcon className='text-primary size-4' />,
      used: usage?.projects ?? 0,
      max: quotas?.['projects.max'] ?? 0,
    },
    {
      key: 'collaborators',
      label: 'Team members',
      icon: <UsersIcon className='text-primary size-4' />,
      used: usage?.collaborators ?? 0,
      max: quotas?.['collaborators.org.max'] ?? 0,
    },
  ];

  const hasAnyQuota =
    quotas && (quotas['projects.max'] !== 0 || quotas['collaborators.org.max'] !== 0);

  return (
    <SettingsSection title='Usage' icon={TrendingUpIcon}>
      {hasAnyQuota ?
        metrics.map(
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
        )
      : <p className='text-muted-foreground px-4 py-6 text-center text-[13px]'>
          The Free plan has no project or team allowance. Upgrade to start a project.
        </p>
      }
    </SettingsSection>
  );
}
