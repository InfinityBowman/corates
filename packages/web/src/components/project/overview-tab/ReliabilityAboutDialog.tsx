/**
 * ReliabilityAboutDialog - spells out how one tool's reliability numbers were
 * produced. Every figure and rule comes from the stats object and the tool
 * definition, so the explanation cannot drift from the calculation.
 */

import {
  CI_Z,
  KAPPA_BANDS,
  MIN_PAIRS_FOR_KAPPA,
  linearDisagreement,
  type LevelStats,
  type ToolReliability,
} from '@corates/shared/checklists/reliability';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatPercent } from './ReliabilitySection';

interface ReliabilityAboutDialogProps {
  tool: ToolReliability;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className='flex flex-col gap-1.5'>
      <h3 className='text-sm font-medium'>{title}</h3>
      <div className='text-muted-foreground flex flex-col gap-1.5 text-sm'>{children}</div>
    </section>
  );
}

function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

function ConfusionMatrix({ level }: { level: LevelStats }) {
  if (!level.scale || !level.matrix) return null;
  const { scale, matrix } = level;
  return (
    <table className='w-full border-collapse text-xs tabular-nums'>
      <caption className='text-muted-foreground mb-1 text-left text-xs'>
        Rows are one reviewer of each pair, columns the other. Matches sit on the diagonal.
      </caption>
      <thead>
        <tr>
          <th scope='col' className='border-border border-b p-1 text-left font-normal' />
          {scale.map(category => (
            <th
              key={category}
              scope='col'
              className='border-border text-muted-foreground border-b p-1 text-right font-normal'
            >
              {category}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {scale.map((rowCategory, i) => (
          <tr key={rowCategory}>
            <th scope='row' className='text-muted-foreground p-1 text-left font-normal'>
              {rowCategory}
            </th>
            {matrix[i].map((count, j) => (
              <td
                key={scale[j]}
                className={`p-1 text-right ${i === j ? 'text-foreground font-medium' : ''}`}
              >
                {count}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ScaleWeights({ scale }: { scale: string[] }) {
  const steps = scale.length - 1;
  const credit = (distance: number) =>
    `${Math.round((1 - linearDisagreement(0, distance, scale.length)) * 100)}%`;
  return (
    <ul className='list-disc pl-5'>
      <li>Same category: 100% agreement</li>
      {Array.from({ length: steps }, (_, k) => k + 1).map(distance => (
        <li key={distance}>
          {distance === 1 ? 'One step apart' : `${distance} steps apart`} (for example {scale[0]}{' '}
          against {scale[distance]}): {credit(distance)}
        </li>
      ))}
    </ul>
  );
}

export function ReliabilityAboutDialog({ tool, open, onOpenChange }: ReliabilityAboutDialogProps) {
  const { definition, judgements, overall, questions } = tool;
  const unit = definition.unit === 'study' ? 'study' : 'outcome';
  const judgementNoun = definition.judgementLabel.toLowerCase();
  const kappa = judgements.kappa;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-xl'>
        <DialogHeader>
          <DialogTitle>How reliability is calculated for {definition.label}</DialogTitle>
          <DialogDescription>
            Two reviewers per {unit}, using their own completed checklists, before reconciliation.
          </DialogDescription>
        </DialogHeader>

        <div className='flex flex-col gap-5'>
          <Section title='What is compared'>
            <p>
              {plural(tool.cells, unit)} across {plural(tool.studies, 'study', 'studies')}.
              Consensus checklists are not used, so the numbers do not change after reconciliation.
            </p>
            <p>
              {definition.judgementLabel} on the scale {definition.judgementScale.join(', ')}.
            </p>
            <ul className='list-disc pl-5'>
              {definition.notes.map(note => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </Section>

          <Section title='Percent agreement'>
            <p>
              {judgements.agreed} of {judgements.compared} compared {judgementNoun} matched:{' '}
              {formatPercent(judgements.percentAgreement)}.
            </p>
          </Section>

          <Section title='Weighted kappa'>
            <p>
              Agreement corrected for chance: kappa = (Po - Pe) / (1 - Pe). Po is the observed
              agreement, Pe the agreement expected from how often each reviewer used each category.
            </p>
            <p>Near misses get partial credit:</p>
            <ScaleWeights scale={definition.judgementScale} />
            {kappa ?
              <p className='tabular-nums'>
                Po {kappa.observed.toFixed(3)}, Pe {kappa.expected.toFixed(3)}, kappa{' '}
                {kappa.kappa.toFixed(3)}. 95% CI {kappa.ci[0].toFixed(2)} to{' '}
                {kappa.ci[1].toFixed(2)}: kappa plus or minus {CI_Z} standard errors, SE{' '}
                {kappa.se.toFixed(3)} (Fleiss, Cohen and Everitt, 1969).
              </p>
            : <p>
                Shown after {MIN_PAIRS_FOR_KAPPA} compared {judgementNoun}. Undefined when every
                rating is the same category.
              </p>
            }
            <p>
              Kappa drops when most judgements share one category, so read it with percent
              agreement. Reviewer pairs vary between studies; the value is pooled across pairs.
            </p>
            <p>
              Bands (Landis and Koch, 1977):{' '}
              {KAPPA_BANDS.filter(band => Number.isFinite(band.min))
                .map(band => `${band.label} from ${band.min}`)
                .join(', ')}
              , Poor below 0.
            </p>
            {judgements.matrix && <ConfusionMatrix level={judgements} />}
          </Section>

          <Section title='Not applicable and unanswered'>
            <p>Only pairs where both reviewers gave a substantive answer are compared.</p>
            <p>
              {plural(judgements.excluded, 'pair')} left out: a reviewer had no answer, or the item
              was not applicable to both.
            </p>
            <p>
              {plural(judgements.oneSided, 'pair')} not applicable to one reviewer only. Not counted
              as disagreements; the earlier answer that caused the split is compared on its own.
            </p>
          </Section>

          <Section
            title={
              definition.type === 'AMSTAR2' ? 'Overall confidence rating' : 'Overall judgement'
            }
          >
            <p>
              Compared on its own scale, {definition.overallScale.join(', ')}: {overall.agreed} of{' '}
              {overall.compared} matched ({formatPercent(overall.percentAgreement)}).
            </p>
          </Section>

          {questions && (
            <Section title='Signaling questions'>
              <p>
                {questions.agreed} of {questions.compared} matched (
                {formatPercent(questions.percentAgreement)}). {questions.oneSided} applicable to one
                reviewer only, {questions.excluded} left out.
              </p>
              <p>
                An explicit not-applicable answer and a question skipped by branching count the
                same. Options differ between questions, so only percent agreement is reported.
              </p>
            </Section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
