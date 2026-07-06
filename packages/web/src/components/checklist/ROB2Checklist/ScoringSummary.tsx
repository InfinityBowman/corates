import { useMemo } from 'react';
import { InfoIcon } from 'lucide-react';
import { ROB2_CHECKLIST, getActiveDomainKeys } from './checklist-map';
import { ResourcesPopover } from '../ResourcesPopover';
import { ROB2_RESOURCES } from './resources';
import { useAnswer, useROB2Score, useROB2DomainScore } from '@/primitives/useProject/reactor/hooks';

interface ScoringSummaryProps {
  studyId: string;
  checklistId: string;
  onDomainClick?: (_domainKey: string) => void;
}

export function ScoringSummary({ studyId, checklistId, onDomainClick }: ScoringSummaryProps) {
  const overallScore = useROB2Score(studyId, checklistId);
  const aim = useAnswer<string>(studyId, checklistId, 'preliminary.aim');
  const isAdhering = aim === 'ADHERING';
  const activeDomains = useMemo(() => getActiveDomainKeys(isAdhering), [isAdhering]);

  const getOverallColor = () => {
    switch (overallScore) {
      case 'Low':
        return 'bg-green-500';
      case 'Some concerns':
        return 'bg-yellow-500';
      case 'High':
        return 'bg-red-500';
      default:
        return 'bg-muted-foreground/70';
    }
  };

  const getDomainShortName = (domainKey: string) => {
    const map: Record<string, string> = {
      domain1: 'D1',
      domain2a: 'D2',
      domain2b: 'D2',
      domain3: 'D3',
      domain4: 'D4',
      domain5: 'D5',
    };
    return map[domainKey] || domainKey;
  };

  return (
    <div className='border-border bg-card rounded-lg border p-4 shadow-sm'>
      <div className='flex flex-wrap items-center justify-between gap-4'>
        {/* Overall score */}
        <div className='flex items-center gap-3'>
          <div className='flex items-center gap-2'>
            <div className={`size-3 rounded-full ${getOverallColor()}`} />
            <span className='text-secondary-foreground text-sm font-medium'>Overall:</span>
            <span className='text-foreground text-sm font-semibold'>
              {overallScore === 'Incomplete' ? 'Incomplete' : overallScore}
            </span>
          </div>
        </div>

        {/* Domain chips */}
        <div className='flex flex-wrap items-center gap-2'>
          {activeDomains.map((domainKey: string) => (
            <DomainChip
              key={domainKey}
              studyId={studyId}
              checklistId={checklistId}
              domainKey={domainKey}
              shortName={getDomainShortName(domainKey)}
              onClick={() => onDomainClick?.(domainKey)}
            />
          ))}

          <ResourcesPopover resources={ROB2_RESOURCES}>
            <button
              type='button'
              className='border-info-border bg-info-bg text-info hover:bg-info-bg/80 ml-2 inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium transition-colors'
            >
              <InfoIcon className='size-3' />
              Resources
            </button>
          </ResourcesPopover>
        </div>
      </div>
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
  const { judgement } = useROB2DomainScore(studyId, checklistId, domainKey);

  const chipColor = (() => {
    if (!judgement) return 'bg-secondary text-muted-foreground border-border';
    switch (judgement) {
      case 'Low':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'Some concerns':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'High':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-secondary text-muted-foreground border-border';
    }
  })();

  return (
    <button
      type='button'
      onClick={onClick}
      title={`${(ROB2_CHECKLIST as any)[domainKey]?.name}: ${judgement || 'Incomplete'}`}
      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium transition-colors hover:opacity-80 ${chipColor}`}
    >
      <span>{shortName}</span>
    </button>
  );
}
