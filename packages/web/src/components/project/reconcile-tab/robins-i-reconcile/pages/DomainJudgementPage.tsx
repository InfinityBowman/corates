import {
  ROBINS_I_CHECKLIST,
  ROB_JUDGEMENTS,
  BIAS_DIRECTIONS,
} from '@/components/checklist/ROBINSIChecklist/checklist-map';
import { JudgementPanel } from '../panels/JudgementPanel';
import { DirectionPanel } from '../panels/DirectionPanel';

interface DomainJudgementPageProps {
  domainKey: string;
  reviewer1Data?: { judgement?: string; direction?: string } | null;
  reviewer2Data?: { judgement?: string; direction?: string } | null;
  finalData?: { judgement?: string; direction?: string } | null;
  reviewer1Name: string;
  reviewer2Name: string;
  judgementMatch?: boolean;
  directionMatch?: boolean;
  onFinalJudgementChange: (_judgement: string) => void;
  onFinalDirectionChange: (_direction: string) => void;
  onUseReviewer1Judgement: () => void;
  onUseReviewer2Judgement: () => void;
  onUseReviewer1Direction: () => void;
  onUseReviewer2Direction: () => void;
  selectedJudgementSource?: 'reviewer1' | 'reviewer2' | null;
  selectedDirectionSource?: 'reviewer1' | 'reviewer2' | null;
}

export function DomainJudgementPage({
  domainKey,
  reviewer1Data,
  reviewer2Data,
  finalData,
  reviewer1Name,
  reviewer2Name,
  judgementMatch,
  directionMatch,
  onFinalJudgementChange,
  onFinalDirectionChange,
  onUseReviewer1Judgement,
  onUseReviewer2Judgement,
  onUseReviewer1Direction,
  onUseReviewer2Direction,
  selectedJudgementSource,
  selectedDirectionSource,
}: DomainJudgementPageProps) {
  const domain = (ROBINS_I_CHECKLIST as Record<string, any>)[domainKey];
  const directionOptions = domain?.directionOptions || BIAS_DIRECTIONS;

  return (
    <div className='flex flex-col gap-4'>
      {/* Domain Header */}
      <div className='bg-card overflow-hidden rounded-lg shadow-lg'>
        <div className='border-border bg-secondary border-b px-4 py-3'>
          <h2 className='text-foreground text-lg font-semibold'>{domain?.name}</h2>
          {domain?.subtitle && <p className='text-muted-foreground text-sm'>{domain.subtitle}</p>}
          <p className='text-secondary-foreground mt-1 text-sm font-medium'>
            Domain Judgement & Direction
          </p>
        </div>
      </div>

      {/* Judgement Row */}
      <div className='bg-card overflow-hidden rounded-lg shadow-lg'>
        <div
          className={`p-3 ${
            judgementMatch ?
              'border-b border-green-200 bg-green-50'
            : 'border-b border-amber-200 bg-amber-50'
          }`}
        >
          <h3 className='text-foreground font-medium'>Risk of Bias Judgement</h3>
          <span
            className={`text-xs font-medium ${
              judgementMatch ? 'text-green-700' : 'text-amber-700'
            }`}
          >
            {judgementMatch ? 'Reviewers Agree' : 'Requires Reconciliation'}
          </span>
        </div>

        <div className='divide-border grid grid-cols-3 divide-x'>
          <JudgementPanel
            title={reviewer1Name}
            panelType='reviewer1'
            judgement={reviewer1Data?.judgement}
            judgementOptions={ROB_JUDGEMENTS}
            readOnly={true}
            hideUseThis={judgementMatch}
            isSelected={selectedJudgementSource === 'reviewer1'}
            onUseThis={onUseReviewer1Judgement}
          />

          <JudgementPanel
            title={reviewer2Name}
            panelType='reviewer2'
            judgement={reviewer2Data?.judgement}
            judgementOptions={ROB_JUDGEMENTS}
            readOnly={true}
            hideUseThis={judgementMatch}
            isSelected={selectedJudgementSource === 'reviewer2'}
            onUseThis={onUseReviewer2Judgement}
          />

          <JudgementPanel
            title='Final Judgement'
            panelType='final'
            judgement={finalData?.judgement}
            judgementOptions={ROB_JUDGEMENTS}
            readOnly={false}
            hideUseThis={true}
            onJudgementChange={onFinalJudgementChange}
          />
        </div>
      </div>

      {/* Direction Row */}
      {domain?.hasDirection && (
        <div className='bg-card overflow-hidden rounded-lg shadow-lg'>
          <div
            className={`p-3 ${
              directionMatch ?
                'border-b border-green-200 bg-green-50'
              : 'border-b border-amber-200 bg-amber-50'
            }`}
          >
            <h3 className='text-foreground font-medium'>Predicted Direction of Bias</h3>
            <span
              className={`text-xs font-medium ${
                directionMatch ? 'text-green-700' : 'text-amber-700'
              }`}
            >
              {directionMatch ? 'Reviewers Agree' : 'Requires Reconciliation'}
            </span>
          </div>

          <div className='divide-border grid grid-cols-3 divide-x'>
            <DirectionPanel
              title={reviewer1Name}
              panelType='reviewer1'
              direction={reviewer1Data?.direction}
              directionOptions={directionOptions}
              readOnly={true}
              hideUseThis={directionMatch}
              isSelected={selectedDirectionSource === 'reviewer1'}
              onUseThis={onUseReviewer1Direction}
            />

            <DirectionPanel
              title={reviewer2Name}
              panelType='reviewer2'
              direction={reviewer2Data?.direction}
              directionOptions={directionOptions}
              readOnly={true}
              hideUseThis={directionMatch}
              isSelected={selectedDirectionSource === 'reviewer2'}
              onUseThis={onUseReviewer2Direction}
            />

            <DirectionPanel
              title='Final Direction'
              panelType='final'
              direction={finalData?.direction}
              directionOptions={directionOptions}
              readOnly={false}
              hideUseThis={true}
              onDirectionChange={onFinalDirectionChange}
            />
          </div>
        </div>
      )}
    </div>
  );
}
