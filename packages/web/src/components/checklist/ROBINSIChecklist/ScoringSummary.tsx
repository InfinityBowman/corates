import { useState, useMemo } from 'react';
import { InfoIcon, ExternalLinkIcon } from 'lucide-react';
import { ROBINS_I_CHECKLIST, getActiveDomainKeys } from './checklist-map';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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

      <ResourcesDialog open={resourcesOpen} onClose={() => setResourcesOpen(false)} />
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

function ResourcesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={s => !s && onClose()}>
      <DialogContent className='max-h-[85vh] max-w-md overflow-auto'>
        <DialogHeader>
          <DialogTitle>ROBINS-I V2 Resources</DialogTitle>
          <DialogDescription>
            Official guidance and documentation for the ROBINS-I assessment tool.
          </DialogDescription>
        </DialogHeader>

        <div className='flex flex-col gap-4 py-4'>
          <ResourceLink
            title='ROBINS-I Tool (Official)'
            description='Risk Of Bias In Non-randomized Studies of Interventions'
            url='https://www.riskofbias.info/welcome/robins-i-v2'
          />
          <ResourceLink
            title='Detailed Guidance Document'
            description='Comprehensive guidance for making judgements'
            url='https://drive.google.com/file/d/1zs85KZKFdwGcYwahvldNY_lARNv7Nqsr/view'
          />
          <ResourceLink
            title='Cochrane Handbook Chapter'
            description='Chapter 25: Assessing risk of bias in non-randomized studies'
            url='https://training.cochrane.org/handbook/current/chapter-25'
          />
          <div className='bg-muted rounded-lg p-3'>
            <h4 className='text-secondary-foreground text-sm font-medium'>About Auto Scoring</h4>
            <p className='text-muted-foreground mt-1 text-xs'>
              This tool automatically calculates domain judgements based on your signalling question
              responses, following the official ROBINS-I decision algorithms. You can override any
              automatic judgement if needed.
            </p>
          </div>
        </div>

        <div className='border-border border-t pt-3'>
          <Button variant='secondary' onClick={onClose} className='w-full'>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResourceLink({
  title,
  description,
  url,
}: {
  title: string;
  description: string;
  url: string;
}) {
  return (
    <a
      href={url}
      target='_blank'
      rel='noopener noreferrer'
      className='border-border block rounded-lg border p-3 transition-colors hover:border-blue-300 hover:bg-blue-50'
    >
      <div className='flex items-start justify-between gap-2'>
        <div>
          <h4 className='text-foreground text-sm font-medium'>{title}</h4>
          <p className='text-muted-foreground mt-0.5 text-xs'>{description}</p>
        </div>
        <ExternalLinkIcon className='text-muted-foreground/70 mt-0.5 size-3.5 shrink-0' />
      </div>
    </a>
  );
}
