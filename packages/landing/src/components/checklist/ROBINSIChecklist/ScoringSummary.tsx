/**
 * ScoringSummary - ROBINS-I scoring strip with domain chips and manual override indicators
 */

import { useState, useMemo } from 'react';
import { InfoIcon, ExternalLinkIcon } from 'lucide-react';
import { ROBINS_I_CHECKLIST, getActiveDomainKeys } from './checklist-map';
import { getSmartScoring } from './checklist.js';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface ScoringSummaryProps {
  checklistState: any;
  onDomainClick?: (_domainKey: string) => void;
}

export function ScoringSummary({ checklistState, onDomainClick }: ScoringSummaryProps) {
  const [resourcesOpen, setResourcesOpen] = useState(false);

  const smartScoring = useMemo(() => getSmartScoring(checklistState), [checklistState]);
  const isPerProtocol = checklistState?.sectionC?.isPerProtocol || false;
  const activeDomains = useMemo(() => getActiveDomainKeys(isPerProtocol), [isPerProtocol]);

  const domainStats = useMemo(() => {
    let complete = 0;
    const total = activeDomains.length;
    activeDomains.forEach((domainKey: string) => {
      if (smartScoring.domains[domainKey]?.effective) complete++;
    });
    return { complete, total };
  }, [smartScoring, activeDomains]);

  const getOverallColor = () => {
    const overall = smartScoring.overall;
    switch (overall) {
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

  const getDomainChipColor = (domainKey: string) => {
    const domainInfo = smartScoring.domains[domainKey];
    if (!domainInfo?.effective) return 'bg-secondary text-muted-foreground border-border';

    const judgement = domainInfo.effective;
    const isManual = domainInfo.source === 'manual';
    let baseColor: string;

    switch (judgement) {
      case 'Low':
      case 'Low (except for concerns about uncontrolled confounding)':
        baseColor = 'bg-green-100 text-green-800 border-green-300';
        break;
      case 'Moderate':
        baseColor = 'bg-yellow-100 text-yellow-800 border-yellow-300';
        break;
      case 'Serious':
        baseColor = 'bg-orange-100 text-orange-800 border-orange-300';
        break;
      case 'Critical':
        baseColor = 'bg-red-100 text-red-800 border-red-300';
        break;
      default:
        baseColor = 'bg-secondary text-muted-foreground border-border';
    }

    if (isManual && domainInfo.isOverridden) {
      return `${baseColor} ring-2 ring-amber-400 ring-offset-1`;
    }
    return baseColor;
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

  const getDomainStatusText = (dk: string) => {
    const domainInfo = smartScoring.domains[dk];
    if (!domainInfo?.effective) return 'Incomplete';
    const j = domainInfo.effective;
    const short = j === 'Low (except for concerns about uncontrolled confounding)' ? 'Low*' : j;
    if (domainInfo.source === 'manual' && domainInfo.isOverridden) return `${short} (manual)`;
    return short;
  };

  return (
    <div className='border-border bg-card rounded-lg border p-4 shadow-sm'>
      <div className='flex flex-wrap items-center justify-between gap-4'>
        <div className='flex items-center gap-3'>
          <div className='flex items-center gap-2'>
            <div className={`size-3 rounded-full ${getOverallColor()}`} />
            <span className='text-secondary-foreground text-sm font-medium'>Overall:</span>
            <span className='text-foreground text-sm font-semibold'>
              {smartScoring.overall || 'Incomplete'}
            </span>
          </div>
          <span className='text-muted-foreground/70 text-xs'>|</span>
          <span className='text-muted-foreground text-xs'>
            {domainStats.complete}/{domainStats.total} domains
          </span>
        </div>

        <div className='flex flex-wrap items-center gap-2'>
          {activeDomains.map((dk: string) => (
            <button
              key={dk}
              type='button'
              onClick={() => onDomainClick?.(dk)}
              title={`${(ROBINS_I_CHECKLIST as any)[dk]?.name}: ${getDomainStatusText(dk)}`}
              className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium transition-colors hover:opacity-80 ${getDomainChipColor(dk)}`}
            >
              <span>{getDomainShortName(dk)}</span>
              {smartScoring.domains[dk]?.source === 'manual' && (
                <span className='text-warning'>*</span>
              )}
            </button>
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
          <button
            type='button'
            onClick={onClose}
            className='bg-secondary text-secondary-foreground hover:bg-muted w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors'
          >
            Close
          </button>
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
