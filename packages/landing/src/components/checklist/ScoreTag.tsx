/**
 * ScoreTag - Displays the current score for a checklist with type-aware styling
 */

import { useMemo } from 'react';
import { InfoIcon } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { getChecklistMetadata, DEFAULT_CHECKLIST_TYPE } from '@/checklist-registry';

function getScoreStyle(score: string, checklistType: string) {
  const metadata = getChecklistMetadata(checklistType) as any;
  const colorConfig = metadata?.scoreColors?.[score];
  if (colorConfig) return `${colorConfig.bg} ${colorConfig.text}`;
  return 'bg-secondary text-muted-foreground';
}

interface ScoreTagProps {
  currentScore: string | null;
  checklistType?: string;
  showRatingOnly?: boolean;
}

export function ScoreTag({ currentScore, checklistType, showRatingOnly }: ScoreTagProps) {
  const type = checklistType || DEFAULT_CHECKLIST_TYPE;
  const styleClass = useMemo(() => currentScore ? getScoreStyle(currentScore, type) : '', [currentScore, type]);

  if (!currentScore) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${styleClass}`}
    >
      {showRatingOnly ?
        <span>{currentScore}</span>
      : <>
          <span>Rating: {currentScore}</span>
          <ScoreTooltip checklistType={type} />
        </>
      }
    </span>
  );
}

interface ScoreTooltipProps {
  checklistType: string;
}

export function ScoreTooltip({ checklistType }: ScoreTooltipProps) {
  const metadata = getChecklistMetadata(checklistType) as any;
  const infoUrl = metadata?.url;
  const tooltipText = `See ${metadata?.shortName || metadata?.name} resources`;

  if (!infoUrl) return <InfoIcon className='h-3 w-3 opacity-50' />;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          href={infoUrl}
          target='_blank'
          rel='noreferrer noopener'
          className='mt-0.5 inline-flex items-center justify-center rounded-full p-0.5 opacity-70 hover:opacity-100 focus:opacity-100'
          aria-label={`Open ${metadata?.name} guidance in a new tab`}
        >
          <InfoIcon className='h-3 w-3' />
        </a>
      </TooltipTrigger>
      <TooltipContent>{tooltipText}</TooltipContent>
    </Tooltip>
  );
}
