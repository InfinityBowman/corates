import { useMemo } from 'react';
import { CheckIcon, XIcon, InfoIcon } from 'lucide-react';
import { scoreAllDomains } from '@/components/checklist/ROBINSIChecklist/scoring/robins-scoring.js';
import { JudgementBadge } from '@/components/checklist/ROBINSIChecklist/DomainJudgement';
import { DirectionPanel } from '../panels/DirectionPanel';

interface OverallDirectionPageProps {
  checklist1: any;
  checklist2: any;
  finalChecklist: any;
  reviewer1Direction: string | null;
  reviewer2Direction: string | null;
  finalDirection: string | null;
  reviewer1Name: string;
  reviewer2Name: string;
  directionMatch: boolean;
  onFinalDirectionChange: (_direction: string) => void;
  onUseReviewer1: () => void;
  onUseReviewer2: () => void;
}

/** Read-only display of an auto-calculated overall judgement. */
function ReadOnlyJudgement({ title, judgement }: { title: string; judgement: string | null }) {
  return (
    <div className='p-4'>
      <h3 className='text-foreground mb-3 font-semibold'>{title}</h3>
      {judgement ?
        <JudgementBadge judgement={judgement} />
      : <span className='text-muted-foreground text-sm italic'>Not yet calculated</span>}
    </div>
  );
}

/**
 * Page for reconciling overall direction and viewing the auto-calculated overall
 * judgement (derived from the domain judgements; no manual override).
 */
export function OverallDirectionPage({
  checklist1,
  checklist2,
  finalChecklist,
  reviewer1Direction,
  reviewer2Direction,
  finalDirection,
  reviewer1Name,
  reviewer2Name,
  directionMatch,
  onFinalDirectionChange,
  onUseReviewer1,
  onUseReviewer2,
}: OverallDirectionPageProps) {
  const reviewer1Scoring = useMemo(() => scoreAllDomains(checklist1), [checklist1]);
  const reviewer2Scoring = useMemo(() => scoreAllDomains(checklist2), [checklist2]);
  const finalScoring = useMemo(() => scoreAllDomains(finalChecklist), [finalChecklist]);

  return (
    <div className='bg-card rounded-xl shadow-lg'>
      {/* Header reflects direction agreement only; the derived overall judgement is
          shown read-only below and follows from the domain judgements. */}
      <div
        className={`rounded-t-xl border-b p-4 ${
          directionMatch ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'
        }`}
      >
        <div className='flex items-start gap-3'>
          {directionMatch ?
            <div className='flex size-6 shrink-0 items-center justify-center rounded-full bg-green-500'>
              <CheckIcon className='size-4 text-white' />
            </div>
          : <div className='flex size-6 shrink-0 items-center justify-center rounded-full bg-amber-500'>
              <XIcon className='size-4 text-white' />
            </div>
          }
          <div>
            <h2 className='text-foreground font-semibold'>
              Overall Risk of Bias - Judgement &amp; Direction
            </h2>
            <p className='text-muted-foreground mt-1 text-sm'>
              Review the overall calculated judgement and select the overall bias direction
            </p>
          </div>
        </div>
      </div>

      {/* Auto-calculated Overall Judgement Section */}
      <div className='border-b p-4'>
        <div className='mb-3 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3'>
          <InfoIcon className='size-4 shrink-0 text-blue-600' />
          <p className='text-xs text-blue-800'>
            The overall risk of bias judgement is automatically calculated from the domain
            judgements. To change it, reconcile the signalling questions.
          </p>
        </div>

        <h3 className='text-secondary-foreground mb-3 text-sm font-semibold'>
          Auto-calculated Overall Judgement
        </h3>

        <div className='grid grid-cols-3 divide-x rounded-lg border'>
          <ReadOnlyJudgement title={reviewer1Name} judgement={reviewer1Scoring.overall} />
          <ReadOnlyJudgement title={reviewer2Name} judgement={reviewer2Scoring.overall} />
          <ReadOnlyJudgement title='Final (Reconciled)' judgement={finalScoring.overall} />
        </div>
      </div>

      {/* Direction Section */}
      <div className='p-4'>
        <div className='mb-3 flex items-center gap-2'>
          <h3 className='text-secondary-foreground text-sm font-semibold'>
            Predicted Overall Direction of Bias
          </h3>
          {directionMatch ?
            <span className='rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700'>
              Agree
            </span>
          : <span className='rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700'>
              Disagree
            </span>
          }
        </div>

        <div className='grid grid-cols-3 divide-x rounded-lg border'>
          <DirectionPanel
            title={reviewer1Name}
            panelType='reviewer1'
            direction={reviewer1Direction}
            readOnly={true}
            onUseThis={onUseReviewer1}
          />
          <DirectionPanel
            title={reviewer2Name}
            panelType='reviewer2'
            direction={reviewer2Direction}
            readOnly={true}
            onUseThis={onUseReviewer2}
          />
          <DirectionPanel
            title='Final Direction'
            panelType='final'
            direction={finalDirection}
            readOnly={false}
            onDirectionChange={onFinalDirectionChange}
            hideUseThis={true}
          />
        </div>
      </div>
    </div>
  );
}
