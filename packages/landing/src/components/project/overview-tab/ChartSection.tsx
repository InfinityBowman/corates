/**
 * ChartSection - Stub for AMSTAR chart visualizations
 * TODO(agent): Migrate AMSTARRobvis, AMSTARDistribution, ChartSettingsModal from D3/SolidJS
 */

interface ChartSectionProps {
  studies: any[];
}

export function ChartSection({ studies }: ChartSectionProps) {
  const hasFinalizedChecklists = studies.some((s: any) =>
    (s.checklists || []).some((c: any) => c.status === 'finalized' && c.type === 'AMSTAR2'),
  );

  if (!hasFinalizedChecklists) {
    return (
      <div className='border-border bg-card rounded-lg border px-4 py-8 text-center'>
        <p className='text-muted-foreground'>
          Once appraisals are completed, this section will display domain-level judgments by review
          and across reviews.
        </p>
      </div>
    );
  }

  return (
    <div className='border-border bg-card rounded-lg border px-4 py-8 text-center'>
      <p className='text-muted-foreground'>
        Chart visualizations will be available after full migration.
      </p>
    </div>
  );
}
