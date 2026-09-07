/**
 * ReliabilitySection - reviewer agreement before reconciliation, as a strip
 * of three tiles with the kappa value placed on the Landis and Koch scale
 */

import { getKappaInterpretation, type InterRaterMetrics } from '@/lib/inter-rater-reliability.js';
import { COLORS } from '@/components/charts/chartConfigs';

interface ReliabilitySectionProps {
  metrics: InterRaterMetrics;
}

// Landis and Koch band boundaries, which getKappaInterpretation also uses
const KAPPA_TICKS = [0, 0.2, 0.4, 0.6, 0.8, 1];

function KappaScale({ kappa }: { kappa: number }) {
  const position = Math.min(Math.max(kappa, 0), 1) * 100;
  return (
    <div className='mt-2' aria-hidden='true'>
      <div
        className='relative h-1 rounded-full'
        style={{
          background: `linear-gradient(90deg, ${COLORS.negative.default} 0 20%, ${COLORS.intermediate.default} 20% 60%, ${COLORS.positive.default} 60% 100%)`,
        }}
      >
        <span
          className='bg-background border-foreground absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2'
          style={{ left: `${position}%` }}
        />
      </div>
      <div className='text-muted-foreground mt-1.5 flex justify-between text-[10px] tabular-nums'>
        {KAPPA_TICKS.map(tick => (
          <span key={tick}>{tick}</span>
        ))}
      </div>
    </div>
  );
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className='border-border flex flex-col gap-0.5 rounded-lg border px-3.5 py-3'>
      <span className='text-muted-foreground text-xs'>{label}</span>
      {children}
    </div>
  );
}

export function ReliabilitySection({ metrics }: ReliabilitySectionProps) {
  const { percentAgreement, cohensKappa, studyCount, totalComparisons, agreementCount } = metrics;

  return (
    <section aria-labelledby='overview-reliability-heading'>
      <div className='mb-2.5 flex items-baseline justify-between gap-4'>
        <h2 id='overview-reliability-heading' className='text-sm font-semibold'>
          Inter-rater reliability
        </h2>
        <span className='text-muted-foreground text-xs'>
          Before reconciliation, across {studyCount} finalized{' '}
          {studyCount === 1 ? 'study' : 'studies'}
        </span>
      </div>
      <div className='grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2.5'>
        <Tile label='Percent agreement'>
          <span className='text-xl font-semibold tabular-nums'>
            {percentAgreement != null ? `${percentAgreement.toFixed(1)}%` : 'N/A'}
          </span>
          <span className='text-muted-foreground text-xs tabular-nums'>
            {agreementCount} of {totalComparisons} judgements matched
          </span>
        </Tile>
        <Tile label="Cohen's kappa">
          {cohensKappa != null ?
            <>
              <span className='text-xl font-semibold tabular-nums'>
                {cohensKappa.toFixed(2)}
                <span className='text-muted-foreground ml-2 text-xs font-medium'>
                  {getKappaInterpretation(cohensKappa)}
                </span>
              </span>
              <KappaScale kappa={cohensKappa} />
            </>
          : <span className='text-xl font-semibold'>N/A</span>}
        </Tile>
        <Tile label='Domain judgements compared'>
          <span className='text-xl font-semibold tabular-nums'>{totalComparisons}</span>
          <span className='text-muted-foreground text-xs'>Two reviewers, same item</span>
        </Tile>
      </div>
    </section>
  );
}
