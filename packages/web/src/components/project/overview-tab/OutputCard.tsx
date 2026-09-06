/**
 * OutputCard — shared card shell for figures and tables in the overview stack (1a).
 */

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type InstrumentKind = 'amstar' | 'rob';

interface OutputCardProps {
  children: ReactNode;
  className?: string;
}

export function OutputCard({ children, className }: OutputCardProps) {
  return (
    <article
      className={cn(
        'bg-card overflow-hidden rounded-[14px] border border-[#e9ebf0]',
        'shadow-[0_1px_2px_rgba(16,24,40,0.04),0_14px_32px_-24px_rgba(16,24,40,0.45)]',
        className,
      )}
    >
      {children}
    </article>
  );
}

interface OutputNumberChipProps {
  prefix: 'FIG' | 'TBL';
  number: number;
}

function OutputNumberChip({ prefix, number }: OutputNumberChipProps) {
  return (
    <span className='rounded-[5px] bg-[#f2f4f7] px-[7px] py-1 font-mono text-[10.5px] leading-none font-semibold tracking-[0.07em] text-[#667085]'>
      {prefix} {number}
    </span>
  );
}

interface InstrumentPillProps {
  label: string;
  kind: InstrumentKind;
}

function InstrumentPill({ label, kind }: InstrumentPillProps) {
  return (
    <span
      className={cn(
        'rounded-full px-2 py-[3px] text-[11.5px] leading-snug font-medium',
        kind === 'amstar' ? 'bg-[#eff4ff] text-[#3538cd]' : 'bg-[#ecfdf3] text-[#067647]',
      )}
    >
      {label}
    </span>
  );
}

interface OutputCardHeaderProps {
  number: number;
  numberPrefix: 'FIG' | 'TBL';
  name: string;
  instrumentLabel: string;
  instrumentKind: InstrumentKind;
  description: string;
  actions?: ReactNode;
}

export function OutputCardHeader({
  number,
  numberPrefix,
  name,
  instrumentLabel,
  instrumentKind,
  description,
  actions,
}: OutputCardHeaderProps) {
  return (
    <div className='flex items-start justify-between gap-6 px-[18px] pt-[15px] pb-[13px]'>
      <div className='flex min-w-0 flex-col gap-[5px]'>
        <div className='flex flex-wrap items-center gap-2'>
          <OutputNumberChip prefix={numberPrefix} number={number} />
          <h3 className='text-[14.5px] leading-snug font-semibold tracking-[-0.008em] text-[#101828]'>
            {name}
          </h3>
          <InstrumentPill label={instrumentLabel} kind={instrumentKind} />
        </div>
        <p className='max-w-[620px] text-[13px] leading-[1.55] text-pretty text-[#667085]'>
          {description}
        </p>
      </div>
      {actions ?
        <div className='flex shrink-0 items-center gap-2'>{actions}</div>
      : null}
    </div>
  );
}

interface OutputCardPlateProps {
  children: ReactNode;
  className?: string;
}

export function OutputCardPlate({ children, className }: OutputCardPlateProps) {
  return (
    <div
      className={cn('border-t border-[#f2f4f7] bg-[#fcfcfd] px-5 pt-[26px] pb-[22px]', className)}
    >
      {children}
    </div>
  );
}
