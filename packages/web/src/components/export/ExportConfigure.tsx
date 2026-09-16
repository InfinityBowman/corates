/**
 * ExportConfigure - the left column of the export dialog: what goes in, how
 * it is formatted, and how it arrives. Every control writes straight into
 * the options the preview and the download both read.
 */

import { useId } from 'react';
import { FileIcon, FileSpreadsheetIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { getChecklistMetadata } from '@/checklist-registry';
import { cn } from '@/lib/utils';
import type { ExportDelivery, ExportOptions } from '@/lib/export/exportOptions';
import type { MemberEntry, OutcomeEntry, StudyInfo } from '@/stores/projectStore';

const ANY = '__any__';

interface ExportConfigureProps {
  options: ExportOptions;
  update: (patch: Partial<ExportOptions>) => void;
  eligible: StudyInfo[];
  selectedIds: Set<string>;
  setStudyIds: (ids: string[] | null) => void;
  outcomes: OutcomeEntry[];
  tools: string[];
  reviewers: MemberEntry[];
  hasConsensus: boolean;
  className?: string;
}

const DELIVERY: Array<{ value: ExportDelivery; label: string; hint: string }> = [
  { value: 'single', label: 'One file', hint: 'Every selected study in a single document' },
  {
    value: 'perAppraisal',
    label: 'File per appraisal',
    hint: 'Separate downloads, one per appraisal',
  },
  { value: 'zip', label: 'ZIP', hint: 'One file per appraisal, packed into one archive' },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className='flex flex-col gap-2.5'>
      <h3 className='text-muted-foreground text-xs font-semibold tracking-wide uppercase'>
        {title}
      </h3>
      {children}
    </section>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (value: T) => void;
  items: Array<{ value: T; label: string }>;
}) {
  return (
    <div className='bg-muted inline-flex w-fit rounded-lg p-0.5'>
      {items.map(item => (
        <button
          key={item.value}
          type='button'
          aria-pressed={value === item.value}
          onClick={() => onChange(item.value)}
          className={cn(
            'rounded-md px-3 py-1 text-sm transition-colors',
            value === item.value ?
              'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function ToggleRow({
  id,
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className='flex items-center justify-between gap-3'>
      <Label htmlFor={id} className='flex flex-col items-start gap-0.5 font-normal'>
        <span>{label}</span>
        {hint && <span className='text-muted-foreground text-xs'>{hint}</span>}
      </Label>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}

export function ExportConfigure({
  options,
  update,
  eligible,
  selectedIds,
  setStudyIds,
  outcomes,
  tools,
  reviewers,
  hasConsensus,
  className,
}: ExportConfigureProps) {
  const uid = useId();
  const isPdf = options.format === 'pdf';

  const toggleStudy = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    setStudyIds([...next]);
  };

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      <Section title='What to export'>
        <Segmented
          value={options.status}
          onChange={status => update({ status })}
          items={[
            { value: 'finalized', label: 'Finalized' },
            { value: 'any', label: 'Everything' },
          ]}
        />

        {(outcomes.length > 0 || tools.length > 1 || reviewers.length > 1) && (
          <div className='flex flex-wrap gap-2'>
            {outcomes.length > 0 && (
              <Select
                value={options.outcomeId ?? ANY}
                onValueChange={v => update({ outcomeId: v === ANY ? null : v })}
              >
                <SelectTrigger size='sm' aria-label='Outcome' className='min-w-32'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any outcome</SelectItem>
                  {outcomes.map(o => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {tools.length > 1 && (
              <Select
                value={options.tool ?? ANY}
                onValueChange={v => update({ tool: v === ANY ? null : v })}
              >
                <SelectTrigger size='sm' aria-label='Tool' className='min-w-28'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any tool</SelectItem>
                  {tools.map(type => (
                    <SelectItem key={type} value={type}>
                      {getChecklistMetadata(type).name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {reviewers.length > 1 && (
              <Select
                value={options.reviewerId ?? ANY}
                onValueChange={v => update({ reviewerId: v === ANY ? null : v })}
              >
                <SelectTrigger size='sm' aria-label='Reviewer' className='min-w-32'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any reviewer</SelectItem>
                  {reviewers.map(m => (
                    <SelectItem key={m.userId} value={m.userId}>
                      {m.name || m.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        <div className='border-border rounded-lg border'>
          <div className='border-border flex items-center justify-between gap-2 border-b px-3 py-1.5'>
            <span className='text-muted-foreground text-xs'>
              {selectedIds.size} of {eligible.length} selected
            </span>
            <div className='flex gap-1'>
              <Button
                variant='ghost'
                size='xs'
                onClick={() => setStudyIds(null)}
                disabled={selectedIds.size === eligible.length}
              >
                Select all
              </Button>
              <Button
                variant='ghost'
                size='xs'
                onClick={() => setStudyIds([])}
                disabled={selectedIds.size === 0}
              >
                Clear
              </Button>
            </div>
          </div>
          <ul className='max-h-52 overflow-y-auto py-1'>
            {eligible.length === 0 && (
              <li className='text-muted-foreground px-3 py-2 text-sm'>
                Nothing matches these filters.
              </li>
            )}
            {eligible.map(study => {
              const id = `${uid}-${study.id}`;
              const toolLabels = [...new Set(study.checklists.map(cl => cl.type))]
                .map(type => getChecklistMetadata(type).name)
                .join(', ');
              return (
                <li
                  key={study.id}
                  className='hover:bg-muted/60 flex items-center gap-2.5 px-3 py-1'
                >
                  <Checkbox
                    id={id}
                    checked={selectedIds.has(study.id)}
                    onCheckedChange={checked => toggleStudy(study.id, checked === true)}
                  />
                  <Label htmlFor={id} className='min-w-0 flex-1 cursor-pointer font-normal'>
                    <span className='truncate'>{study.name || 'Untitled study'}</span>
                  </Label>
                  <span className='text-muted-foreground shrink-0 text-xs'>{toolLabels}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </Section>

      <Section title='Format'>
        <RadioGroup
          value={options.format}
          onValueChange={format => update({ format: format as ExportOptions['format'] })}
          className='grid grid-cols-2 gap-2'
        >
          {(
            [
              ['pdf', 'PDF report', 'For sharing and appendices', FileIcon],
              ['csv', 'CSV table', 'For analysis and robvis', FileSpreadsheetIcon],
            ] as const
          ).map(([value, label, hint, Icon]) => (
            <Label
              key={value}
              htmlFor={`${uid}-format-${value}`}
              className={cn(
                'border-border flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 font-normal',
                options.format === value && 'border-primary bg-primary/5',
              )}
            >
              <RadioGroupItem id={`${uid}-format-${value}`} value={value} className='mt-0.5' />
              <span className='flex flex-col gap-0.5'>
                <span className='flex items-center gap-1.5 font-medium'>
                  <Icon className='size-3.5' />
                  {label}
                </span>
                <span className='text-muted-foreground text-xs'>{hint}</span>
              </span>
            </Label>
          ))}
        </RadioGroup>
      </Section>

      <Section title='Include'>
        {hasConsensus && (
          <ToggleRow
            id={`${uid}-consensus`}
            label='Consensus only'
            hint={
              options.reviewerId ?
                'Off while a reviewer is selected'
              : 'Hides reviewer copies where a consensus exists'
            }
            checked={options.consensusOnly && !options.reviewerId}
            disabled={Boolean(options.reviewerId)}
            onChange={consensusOnly => update({ consensusOnly })}
          />
        )}
        <ToggleRow
          id={`${uid}-notes`}
          label='Support for judgement and notes'
          hint='Comments on each question and free-text notes'
          checked={options.includeNotes}
          onChange={includeNotes => update({ includeNotes })}
        />
        {isPdf && (
          <ToggleRow
            id={`${uid}-signalling`}
            label='Signalling question answers'
            hint='Every question and response, not just the domain judgement'
            checked={options.includeSignallingQuestions}
            onChange={includeSignallingQuestions => update({ includeSignallingQuestions })}
          />
        )}
        {isPdf && (
          <div className='flex items-center justify-between gap-3'>
            <span className='text-sm'>Page setup</span>
            <div className='flex gap-1.5'>
              <Select
                value={options.pageSize}
                onValueChange={v => update({ pageSize: v as ExportOptions['pageSize'] })}
              >
                <SelectTrigger size='sm' aria-label='Page size'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='a4'>A4</SelectItem>
                  <SelectItem value='letter'>Letter</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={options.orientation}
                onValueChange={v => update({ orientation: v as ExportOptions['orientation'] })}
              >
                <SelectTrigger size='sm' aria-label='Orientation'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='portrait'>Portrait</SelectItem>
                  <SelectItem value='landscape'>Landscape</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </Section>

      <Section title='Deliver as'>
        <RadioGroup
          value={options.delivery}
          onValueChange={delivery => update({ delivery: delivery as ExportDelivery })}
          className='gap-1.5'
        >
          {DELIVERY.map(item => (
            <Label
              key={item.value}
              htmlFor={`${uid}-delivery-${item.value}`}
              className='flex cursor-pointer items-center gap-2.5 py-0.5 font-normal'
            >
              <RadioGroupItem id={`${uid}-delivery-${item.value}`} value={item.value} />
              <span className='flex flex-col gap-0.5'>
                <span>{item.label}</span>
                <span className='text-muted-foreground text-xs'>{item.hint}</span>
              </span>
            </Label>
          ))}
        </RadioGroup>
      </Section>
    </div>
  );
}
