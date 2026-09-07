/**
 * OverviewTab - progress, reliability and results in the main column, with
 * members and outcomes in a rail on the right. The owner's first-run setup
 * lives here too: a hero while the project is empty, a compact card once
 * studies exist.
 */

import { useState, useMemo } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { useAllStudies, useProjectMembers, useProjectMeta } from '@/project/workspace-data';
import { useProjectStore, selectConnectionPhase } from '@/stores/projectStore';
import { project } from '@/project';
import { useProjectContext, type ProjectMember } from '../ProjectContext';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { CHECKLIST_STATUS } from '@corates/shared/checklists';
import {
  calculateInterRaterReliability,
  type InterRaterMetrics,
} from '@/lib/inter-rater-reliability.js';
import { ChartSection } from './ChartSection';
import { ResultsTables } from './ResultsTables';
import { ProgressSection } from './ProgressSection';
import { ReliabilitySection } from './ReliabilitySection';
import { MembersPanel } from './MembersPanel';
import { OutcomesPanel } from './OutcomesPanel';
import { countStages } from './studyStage';
import { ProjectSetupPanel } from '../setup/ProjectSetupPanel';
import { ProjectSetupCard } from '../setup/ProjectSetupCard';

function CollapsibleCard({
  title,
  open,
  onOpenChange,
  children,
}: {
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className='border-border bg-card overflow-hidden rounded-lg border'>
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <CollapsibleTrigger className='hover:bg-muted/50 focus-visible:ring-primary flex w-full cursor-pointer items-center justify-between px-4 py-3 transition-colors select-none focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset'>
          <h2 className='text-sm font-semibold'>{title}</h2>
          <ChevronDownIcon
            className={`text-muted-foreground size-4 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className='border-border border-t px-4 pt-4 pb-5'>{children}</div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export function OverviewTab() {
  const { projectId, isOwner } = useProjectContext();
  const studies = useAllStudies(projectId);
  const members = useProjectMembers(projectId) as ProjectMember[];
  const meta = useProjectMeta(projectId);
  const connectionState = useProjectStore(s => selectConnectionPhase(s, projectId));
  // Wait for the first sync before treating the project as empty, so a cold
  // refresh does not flash the setup hero over a project that has studies.
  const hasData = connectionState.phase === 'synced' || studies.length > 0;
  const showSetup = isOwner && meta.setupStep !== null;
  const empty = studies.length === 0;

  const [chartsExpanded, setChartsExpanded] = useState(true);
  const [tablesExpanded, setTablesExpanded] = useState(false);

  const stageCounts = useMemo(() => countStages(studies), [studies]);

  const progressByUser = useMemo(() => {
    const map = new Map<string, { completed: number; total: number }>();
    for (const study of studies) {
      for (const userId of [study.reviewer1, study.reviewer2]) {
        if (!userId) continue;
        const entry = map.get(userId) ?? { completed: 0, total: 0 };
        entry.total += 1;
        const done = (study.checklists || [])
          .filter(c => c.assignedTo === userId)
          .some(
            c =>
              c.status === CHECKLIST_STATUS.FINALIZED ||
              c.status === CHECKLIST_STATUS.REVIEWER_COMPLETED,
          );
        if (done) entry.completed += 1;
        map.set(userId, entry);
      }
    }
    return map;
  }, [studies]);

  const interRaterMetrics: InterRaterMetrics = useMemo(() => {
    // getData throws while the pool has no active connection (a cold refresh
    // renders this tab from cached rows before the gate's effects run) --
    // treat that window as "no data" rather than crashing into the section
    // error boundary.
    const getChecklistData = (studyId: string, checklistId: string) => {
      try {
        return project.checklist.getData(studyId, checklistId);
      } catch {
        return null;
      }
    };
    return calculateInterRaterReliability(studies, getChecklistData);
  }, [studies]);

  return (
    <div className='grid h-full lg:grid-cols-[minmax(0,1fr)_320px]'>
      <div className='flex min-w-0 flex-col gap-10 px-6 py-6'>
        {hasData && empty && showSetup ?
          <ProjectSetupPanel />
        : <>
            {!empty && showSetup && <ProjectSetupCard />}

            <ProgressSection counts={stageCounts} total={studies.length} />

            {interRaterMetrics.studyCount > 0 && <ReliabilitySection metrics={interRaterMetrics} />}

            {!empty && (
              <section aria-labelledby='overview-results-heading'>
                <h2 id='overview-results-heading' className='mb-3 text-sm font-semibold'>
                  Results
                </h2>
                {stageCounts.final > 0 ?
                  <div className='flex flex-col gap-3'>
                    <CollapsibleCard
                      title='Figures'
                      open={chartsExpanded}
                      onOpenChange={setChartsExpanded}
                    >
                      <ChartSection studies={studies} />
                    </CollapsibleCard>
                    <CollapsibleCard
                      title='Tables'
                      open={tablesExpanded}
                      onOpenChange={setTablesExpanded}
                    >
                      <ResultsTables studies={studies} />
                    </CollapsibleCard>
                  </div>
                : <p className='text-muted-foreground text-sm'>
                    Figures and tables appear once the first study is finalized.
                  </p>
                }
              </section>
            )}
          </>
        }
      </div>

      <aside className='border-border flex flex-col gap-8 border-t px-5 py-6 lg:border-t-0 lg:border-l'>
        <MembersPanel
          members={members}
          progressFor={userId => progressByUser.get(userId) ?? { completed: 0, total: 0 }}
        />
        <OutcomesPanel studies={studies} />
      </aside>
    </div>
  );
}
