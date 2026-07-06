import { useState, useMemo } from 'react';
import { InfoIcon } from 'lucide-react';
import { ROBINS_I_CHECKLIST, getActiveDomainKeys } from './checklist-map';
import { ResourcesDialog } from '../ResourcesDialog';
import { ROBINSI_RESOURCES } from './resources';
import {
  useAnswer,
  useROBINSIScore,
  useROBINSIDomainScore,
} from '@/primitives/useProject/reactor/hooks';

interface ScoringSummaryProps {
  studyId: string;
  checklistId: string;
  onDomainClick?: (_domainKey: string) => void;
}

export function ScoringSummary({ studyId, checklistId, onDomainClick }: ScoringSummaryProps) {
  const [resourcesOpen, setResourcesOpen] = useState(false);

  const overallScore = useROBINSIScore(studyId, checklistId);
  const isPerProtocol = useAnswer<boolean>(studyId, checklistId, 'sectionC.isPerProtocol') === true;
  const activeDomains = useMemo(() => getActiveDomainKeys(isPerProtocol), [isPerProtocol]);

  const getOverallColor = () => {
    switch (overallScore) {
      case 'Low':
      case 'Low (except for concerns about uncontrolled confounding)':
        return 'bg-green-500';
      case 'Moderate':
        return 'bg-yellow-500';
      case 'Serious':
        return 'bg-orange-500';
      case 'Critical':
        return 'bg-red-500';
      default:
        return 'bg-muted-foreground/70';
    }
  };

  const getDomainShortName = (dk: string) => {
    const map: Record<string, string> = {
      domain1a: 'D1',
      domain1b: 'D1',
      domain2: 'D2',
      domain3: 'D3',
      domain4: 'D4',
      domain5: 'D5',
      domain6: 'D6',
    };
    return map[dk] || dk;
  };

  return (
    <div className='border-border bg-card rounded-lg border p-4 shadow-sm'>
      <div className='flex flex-wrap items-center justify-between gap-4'>
        <div className='flex items-center gap-3'>
          <div className='flex items-center gap-2'>
            <div className={`size-3 rounded-full ${getOverallColor()}`} />
            <span className='text-secondary-foreground text-sm font-medium'>Overall:</span>
            <span className='text-foreground text-sm font-semibold'>
              {overallScore === 'Incomplete' ? 'Incomplete' : overallScore}
            </span>
          </div>
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          {activeDomains.map((dk: string) => (
            <DomainChip
              key={dk}
              studyId={studyId}
              checklistId={checklistId}
              domainKey={dk}
              shortName={getDomainShortName(dk)}
              onClick={() => onDomainClick?.(dk)}
            />
          ))}

          <button
            type='button'
            onClick={() => setResourcesOpen(true)}
            className='border-info-border bg-info-bg text-info hover:bg-info-bg/80 ml-2 inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium transition-colors'
          >
            <InfoIcon className='size-3' />
            Resources
          </button>
        </div>
      </div>

      <ResourcesDialog
        open={resourcesOpen}
        onClose={() => setResourcesOpen(false)}
        resources={ROBINSI_RESOURCES}
      />
    </div>
  );
}

function DomainChip({
  studyId,
  checklistId,
  domainKey,
  shortName,
  onClick,
}: {
  studyId: string;
  checklistId: string;
  domainKey: string;
  shortName: string;
  onClick: () => void;
}) {
  const { judgement: effective } = useROBINSIDomainScore(studyId, checklistId, domainKey);

  const chipColor = (() => {
    if (!effective) return 'bg-secondary text-muted-foreground border-border';
    switch (effective) {
      case 'Low':
      case 'Low (except for concerns about uncontrolled confounding)':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'Moderate':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'Serious':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'Critical':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-secondary text-muted-foreground border-border';
    }
  })();

  return (
    <button
      type='button'
      onClick={onClick}
      title={`${(ROBINS_I_CHECKLIST as any)[domainKey]?.name}: ${effective || 'Incomplete'}`}
      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium transition-colors hover:opacity-80 ${chipColor}`}
    >
      <span>{shortName}</span>
    </button>
  );
}

