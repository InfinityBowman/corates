/**
 * ReliabilitySection - reviewer agreement before reconciliation, one card per
 * appraisal tool. Each card has a strip of three tiles, a per-domain (or
 * per-item) breakdown, and a dialog explaining the calculation from the same
 * numbers.
 */

import { useState } from 'react';
import { CircleHelpIcon } from 'lucide-react';
import {
  getKappaInterpretation,
  KAPPA_BANDS,
  MIN_PAIRS_FOR_KAPPA,
  type LevelStats,
  type ToolReliability,
} from '@corates/shared/checklists/reliability';
import { Button } from '@/components/ui/button';
import { COLORS } from '@/components/charts/chartConfigs';
import { ReliabilityAboutDialog } from './ReliabilityAboutDialog';

interface ReliabilitySectionProps {
  tools: ToolReliability[];
}

// Landis and Koch band boundaries, which getKappaInterpretation also uses
const KAPPA_TICKS = KAPPA_BANDS.map(band => band.min)
  .filter(min => Number.isFinite(min))
  .concat(1)
  .sort((a, b) => a - b);

const TILE_CLASS = 'border-border flex flex-col gap-0.5 rounded-lg border px-3.5 py-3';

export function formatPercent(value: number | null): string {
  return value == null ? 'N/A' : `${value.toFixed(1)}%`;
}

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
    <div className={TILE_CLASS}>
      <span className='text-muted-foreground text-xs'>{label}</span>
      {children}
    </div>
  );
}

function KappaTile({ level }: { level: LevelStats }) {
  const { kappa, compared } = level;
  if (kappa) {
    return (
      <Tile label='Weighted kappa'>
        <span className='text-xl font-semibold tabular-nums'>
          {kappa.kappa.toFixed(2)}
          <span className='text-muted-foreground ml-2 text-xs font-medium'>
            {getKappaInterpretation(kappa.kappa)}
          </span>
        </span>
        <span className='text-muted-foreground text-xs tabular-nums'>
          95% CI {kappa.ci[0].toFixed(2)} to {kappa.ci[1].toFixed(2)}
        </span>
        <KappaScale kappa={kappa.kappa} />
      </Tile>
    );
  }
  const short = MIN_PAIRS_FOR_KAPPA - compared;
  return (
    <Tile label='Weighted kappa'>
      <span className='text-xl font-semibold'>N/A</span>
      <span className='text-muted-foreground text-xs'>
        {short > 0 ?
          `Needs ${short} more ${short === 1 ? 'comparison' : 'comparisons'}`
        : 'Undefined when every judgement is the same category'}
      </span>
    </Tile>
  );
}

function ItemBreakdown({ level }: { level: LevelStats }) {
  const items = level.items.filter(item => item.compared > 0);
  if (items.length === 0) return null;
  return (
    <ul className='flex flex-wrap gap-1.5' aria-label='Agreement by item'>
      {items.map(item => {
        const percent = (item.agreed / item.compared) * 100;
        return (
          <li
            key={item.key}
            className='border-border flex min-w-16 flex-col gap-1 rounded-md border px-2 py-1.5 text-xs'
            title={`${item.title}: ${item.agreed} of ${item.compared} matched`}
          >
            <span className='flex justify-between gap-2'>
              <span className='text-muted-foreground'>{item.label}</span>
              <span className='font-medium tabular-nums'>{Math.round(percent)}%</span>
            </span>
            <span className='bg-muted h-0.5 w-full rounded-full' aria-hidden='true'>
              <span
                className='bg-foreground/70 block h-full rounded-full'
                style={{ width: `${percent}%` }}
              />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function scopeText(tool: ToolReliability): string {
  const studies = `${tool.studies} ${tool.studies === 1 ? 'study' : 'studies'}`;
  if (tool.definition.unit === 'study') return studies;
  return `${tool.cells} ${tool.cells === 1 ? 'outcome' : 'outcomes'} across ${studies}`;
}

function ToolCard({ tool }: { tool: ToolReliability }) {
  const [aboutOpen, setAboutOpen] = useState(false);
  const { definition, judgements, overall, questions } = tool;
  const overallLabel =
    definition.type === 'AMSTAR2' ? 'Overall confidence rating' : 'Overall judgement';

  return (
    <div className='border-border bg-card flex flex-col gap-3 rounded-lg border p-4'>
      <div className='flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1'>
        <div className='flex items-baseline gap-2'>
          <h3 className='text-sm font-medium'>{definition.label}</h3>
          <span className='text-muted-foreground text-xs'>{scopeText(tool)}</span>
        </div>
        <Button variant='ghost' size='xs' onClick={() => setAboutOpen(true)}>
          <CircleHelpIcon className='size-3.5' />
          How this is calculated
        </Button>
      </div>

      <div className='grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2.5'>
        <Tile label={`${definition.judgementLabel} agreement`}>
          <span className='text-xl font-semibold tabular-nums'>
            {formatPercent(judgements.percentAgreement)}
          </span>
          <span className='text-muted-foreground text-xs tabular-nums'>
            {judgements.agreed} of {judgements.compared} matched
          </span>
        </Tile>
        <KappaTile level={judgements} />
        <Tile label={overallLabel}>
          <span className='text-xl font-semibold tabular-nums'>
            {formatPercent(overall.percentAgreement)}
          </span>
          <span className='text-muted-foreground text-xs tabular-nums'>
            {overall.agreed} of {overall.compared} matched
          </span>
        </Tile>
      </div>

      <ItemBreakdown level={judgements} />

      {questions && questions.compared > 0 && (
        <p className='text-muted-foreground text-xs tabular-nums'>
          Signaling questions: {formatPercent(questions.percentAgreement)} agreement across{' '}
          {questions.compared} compared
          {questions.oneSided > 0 && `, ${questions.oneSided} applicable to one reviewer only`}
        </p>
      )}

      <ReliabilityAboutDialog tool={tool} open={aboutOpen} onOpenChange={setAboutOpen} />
    </div>
  );
}

export function ReliabilitySection({ tools }: ReliabilitySectionProps) {
  return (
    <section aria-labelledby='overview-reliability-heading'>
      <div className='mb-2.5 flex items-baseline justify-between gap-4'>
        <h2 id='overview-reliability-heading' className='text-sm font-semibold'>
          Inter-rater reliability
        </h2>
        <span className='text-muted-foreground text-xs'>
          Before reconciliation, pooled across reviewer pairs
        </span>
      </div>
      <div className='flex flex-col gap-3'>
        {tools.map(tool => (
          <ToolCard key={tool.definition.type} tool={tool} />
        ))}
      </div>
    </section>
  );
}
