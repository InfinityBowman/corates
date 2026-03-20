import { useMemo } from 'react';
import { CheckIcon, XIcon, InfoIcon } from 'lucide-react';
import { scoreAllDomains } from '@corates/shared/checklists/rob2';
import { JudgementPanel } from '../panels/JudgementPanel';
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

/**
 * Page for reconciling overall direction and viewing auto-calculated overall judgement
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

  const judgementMatch = reviewer1Scoring.overall === reviewer2Scoring.overall;

  return (
    <div className='bg-card rounded-xl shadow-lg'>
      {/* Header */}
      <div
        className={`rounded-t-xl border-b p-4 ${
          directionMatch && judgementMatch ?
            'border-green-200 bg-green-50'
          : 'border-amber-200 bg-amber-50'
        }`}
      >
        <div className='flex items-start gap-3'>
          {directionMatch && judgementMatch ?
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
          <div className='text-xs text-blue-800'>
            <p>
              The overall risk of bias judgement is automatically calculated from the domain
              judgements:
            </p>
            <ul className='mt-1 ml-4 list-disc'>
              <li>
                If any domain is <strong>High</strong>, overall is High
              </li>
              <li>
                Otherwise, if any domain has <strong>Some concerns</strong>, overall is Some
                concerns
              </li>
              <li>
                Otherwise, overall is <strong>Low</strong>
              </li>
            </ul>
          </div>
        </div>

        <h3 className='text-secondary-foreground mb-3 text-sm font-semibold'>
          Auto-calculated Overall Judgement
        </h3>

        <div className='grid grid-cols-3 divide-x rounded-lg border'>
          <JudgementPanel
            title={reviewer1Name || 'Reviewer 1'}
            panelType='reviewer1'
            judgement={reviewer1Scoring.overall}
            isComplete={reviewer1Scoring.isComplete}
          />
          <JudgementPanel
            title={reviewer2Name || 'Reviewer 2'}
            panelType='reviewer2'
            judgement={reviewer2Scoring.overall}
            isComplete={reviewer2Scoring.isComplete}
          />
          <JudgementPanel
            title='Final (Reconciled)'
            panelType='final'
            judgement={finalScoring.overall}
            isComplete={finalScoring.isComplete}
          />
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
            title={reviewer1Name || 'Reviewer 1'}
            panelType='reviewer1'
            direction={reviewer1Direction}
            readOnly={true}
            onUseThis={onUseReviewer1}
          />
          <DirectionPanel
            title={reviewer2Name || 'Reviewer 2'}
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
