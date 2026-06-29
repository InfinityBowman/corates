import { useMemo } from 'react';
import { CheckIcon, XIcon, InfoIcon } from 'lucide-react';
import {
  ROBINS_I_CHECKLIST,
  BIAS_DIRECTIONS,
} from '@/components/checklist/ROBINSIChecklist/checklist-map';
import { scoreRobinsDomain } from '@/components/checklist/ROBINSIChecklist/scoring/robins-scoring.js';
import { JudgementBadge } from '@/components/checklist/ROBINSIChecklist/DomainJudgement';
import { DirectionPanel } from '../panels/DirectionPanel';

interface DomainDirectionPageProps {
  domainKey: string;
  reviewer1Answers: any;
  reviewer2Answers: any;
  finalAnswers: any;
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

/** Read-only display of an auto-calculated domain judgement. */
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
 * Page for reconciling domain direction and viewing the auto-calculated judgement.
 * The judgement is always derived from the signalling answers (no manual override),
 * so only the direction is reconciled here.
 */
export function DomainDirectionPage({
  domainKey,
  reviewer1Answers,
  reviewer2Answers,
  finalAnswers,
  reviewer1Direction,
  reviewer2Direction,
  finalDirection,
  reviewer1Name,
  reviewer2Name,
  directionMatch,
  onFinalDirectionChange,
  onUseReviewer1,
  onUseReviewer2,
}: DomainDirectionPageProps) {
  const domain = (ROBINS_I_CHECKLIST as Record<string, any>)[domainKey];
  const directionOptions = domain?.directionOptions || BIAS_DIRECTIONS;

  const reviewer1Scoring = useMemo(
    () => scoreRobinsDomain(domainKey, reviewer1Answers),
    [domainKey, reviewer1Answers],
  );
  const reviewer2Scoring = useMemo(
    () => scoreRobinsDomain(domainKey, reviewer2Answers),
    [domainKey, reviewer2Answers],
  );
  const finalScoring = useMemo(
    () => scoreRobinsDomain(domainKey, finalAnswers),
    [domainKey, finalAnswers],
  );

  return (
    <div className='bg-card rounded-xl shadow-lg'>
      {/* Header reflects direction agreement only; the derived judgement is shown
          read-only below and reconciled via the signalling questions. */}
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
              {domain?.name} - Judgement &amp; Direction
            </h2>
            <p className='text-muted-foreground mt-1 text-sm'>
              Review the calculated judgement and select the bias direction
            </p>
          </div>
        </div>
      </div>

      {/* Auto-calculated Judgement Section */}
      <div className='border-b p-4'>
        <div className='mb-3 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3'>
          <InfoIcon className='size-4 shrink-0 text-blue-600' />
          <p className='text-xs text-blue-800'>
            The risk of bias judgement is automatically calculated from the signalling question
            answers. To change it, reconcile the signalling questions above.
          </p>
        </div>

        <h3 className='text-secondary-foreground mb-3 text-sm font-semibold'>
          Auto-calculated Judgement
        </h3>

        <div className='grid grid-cols-3 divide-x rounded-lg border'>
          <ReadOnlyJudgement title={reviewer1Name} judgement={reviewer1Scoring.judgement} />
          <ReadOnlyJudgement title={reviewer2Name} judgement={reviewer2Scoring.judgement} />
          <ReadOnlyJudgement title='Final (Reconciled)' judgement={finalScoring.judgement} />
        </div>
      </div>

      {/* Direction Section */}
      <div className='p-4'>
        <div className='mb-3 flex items-center gap-2'>
          <h3 className='text-secondary-foreground text-sm font-semibold'>
            Predicted Direction of Bias
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
            directionOptions={directionOptions}
            readOnly={true}
            onUseThis={onUseReviewer1}
          />
          <DirectionPanel
            title={reviewer2Name}
            panelType='reviewer2'
            direction={reviewer2Direction}
            directionOptions={directionOptions}
            readOnly={true}
            onUseThis={onUseReviewer2}
          />
          <DirectionPanel
            title='Final Direction'
            panelType='final'
            direction={finalDirection}
            directionOptions={directionOptions}
            readOnly={false}
            onDirectionChange={onFinalDirectionChange}
            hideUseThis={true}
          />
        </div>
      </div>
    </div>
  );
}
