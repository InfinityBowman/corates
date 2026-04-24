/**
 * DevStudyGenerator - Add studies with auto-filled checklists and optional reconciliation
 *
 * Reads project members and outcomes from the project store to populate dropdowns.
 * Calls POST /dev/add-study on the backend to generate the study directly in the Y.Doc.
 */

import { useState } from 'react';
import { PlusIcon, CheckIcon, AlertCircleIcon } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { addStudyAction } from '@/server/functions/dev-tools.functions';

interface ActionResult {
  success: boolean;
  message: string;
}

interface MemberEntry {
  userId: string;
  name?: string;
  email?: string;
  role?: string;
}

interface OutcomeEntry {
  id: string;
  name?: string;
}

const CHECKLIST_TYPES = [
  { value: 'AMSTAR2', label: 'AMSTAR2' },
  { value: 'ROB2', label: 'ROB2' },
  { value: 'ROBINS_I', label: 'ROBINS-I' },
];

const FILL_MODES = [
  { value: 'random', label: 'Random' },
  { value: 'all-yes', label: 'All Yes' },
  { value: 'mixed', label: 'Mixed' },
];

interface DevStudyGeneratorProps {
  projectId: string | null;
  orgId: string | null;
}

export function DevStudyGenerator({ projectId, orgId }: DevStudyGeneratorProps) {
  const projectData = useProjectStore(s => (projectId ? s.projects[projectId] || null : null));

  const members: MemberEntry[] = (projectData?.members as MemberEntry[]) || [];
  const outcomes: OutcomeEntry[] = (projectData?.meta?.outcomes as OutcomeEntry[]) || [];

  const [type, setType] = useState('AMSTAR2');
  const [fillMode, setFillMode] = useState('random');
  const [reviewer1, setReviewer1] = useState('');
  const [reviewer2, setReviewer2] = useState('');
  const [outcomeId, setOutcomeId] = useState('__auto__');
  const [reconcile, setReconcile] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  const requiresOutcome = type === 'ROB2' || type === 'ROBINS_I';
  const canSubmit = reviewer1 && reviewer2 && reviewer1 !== reviewer2 && !isAdding;

  const getMemberLabel = (m: MemberEntry) => {
    if (m.name) return `${m.name} (${m.role || 'member'})`;
    if (m.email) return `${m.email} (${m.role || 'member'})`;
    return m.userId.slice(0, 12) + '...';
  };

  const handleAdd = async () => {
    if (!projectId || !orgId || !canSubmit) return;

    setIsAdding(true);
    setResult(null);

    try {
      const data = (await addStudyAction({
        data: {
          orgId,
          projectId,
          type,
          fillMode,
          reviewer1,
          reviewer2,
          reconcile,
          ...(requiresOutcome ? { outcomeId: outcomeId === '__auto__' ? null : outcomeId } : {}),
        },
      })) as { checklistIds?: string[]; outcomeId?: string };
      const checklistCount = data.checklistIds?.length || 0;
      setResult({
        success: true,
        message: `Added study with ${checklistCount} checklists${data.outcomeId ? ` (outcome: ${data.outcomeId.slice(0, 12)}...)` : ''}`,
      });
    } catch (err) {
      setResult({ success: false, message: (err as Error).message });
    } finally {
      setIsAdding(false);
    }
  };

  const selectClass =
    'border-border bg-card text-foreground w-full rounded border px-2 py-1.5 text-xs focus:border-purple-500 focus:outline-none';
  const labelClass = 'text-2xs text-muted-foreground font-medium tracking-wide uppercase';

  return (
    <div className='border-border flex flex-col gap-3 border-t pt-3'>
      <h4 className='text-foreground text-xs font-semibold'>Study Generator</h4>

      {members.length < 2 && (
        <div className='bg-warning-bg text-warning-foreground rounded p-2 text-xs'>
          Project needs at least 2 members to assign reviewers.
        </div>
      )}

      <div className='flex gap-2'>
        <div className='flex flex-1 flex-col gap-1'>
          <label className={labelClass}>Type</label>
          <select
            className={selectClass}
            value={type}
            onChange={e => setType(e.target.value)}
            disabled={isAdding}
          >
            {CHECKLIST_TYPES.map(t => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div className='flex flex-1 flex-col gap-1'>
          <label className={labelClass}>Fill Mode</label>
          <select
            className={selectClass}
            value={fillMode}
            onChange={e => setFillMode(e.target.value)}
            disabled={isAdding}
          >
            {FILL_MODES.map(f => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className='flex gap-2'>
        <div className='flex flex-1 flex-col gap-1'>
          <label className={labelClass}>Reviewer 1</label>
          <select
            className={selectClass}
            value={reviewer1}
            onChange={e => setReviewer1(e.target.value)}
            disabled={isAdding}
          >
            <option value=''>Select...</option>
            {members
              .filter(m => m.userId !== reviewer2)
              .map(m => (
                <option key={m.userId} value={m.userId}>
                  {getMemberLabel(m)}
                </option>
              ))}
          </select>
        </div>
        <div className='flex flex-1 flex-col gap-1'>
          <label className={labelClass}>Reviewer 2</label>
          <select
            className={selectClass}
            value={reviewer2}
            onChange={e => setReviewer2(e.target.value)}
            disabled={isAdding}
          >
            <option value=''>Select...</option>
            {members
              .filter(m => m.userId !== reviewer1)
              .map(m => (
                <option key={m.userId} value={m.userId}>
                  {getMemberLabel(m)}
                </option>
              ))}
          </select>
        </div>
      </div>

      {requiresOutcome && (
        <div className='flex flex-col gap-1'>
          <label className={labelClass}>Outcome</label>
          <select
            className={selectClass}
            value={outcomeId}
            onChange={e => setOutcomeId(e.target.value)}
            disabled={isAdding}
          >
            <option value='__auto__'>Auto-create new outcome</option>
            {outcomes.map(o => (
              <option key={o.id} value={o.id}>
                {o.name || o.id.slice(0, 16)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className='flex items-center gap-3'>
        <label className='text-muted-foreground flex cursor-pointer items-center gap-1.5 text-xs'>
          <input
            type='checkbox'
            checked={reconcile}
            onChange={e => setReconcile(e.target.checked)}
            disabled={isAdding}
            className='accent-purple-600'
          />
          Auto-reconcile
        </label>

        <button
          className='ml-auto flex items-center gap-1.5 rounded bg-purple-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50'
          onClick={handleAdd}
          disabled={!canSubmit}
        >
          {isAdding ?
            <span className='size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent' />
          : <PlusIcon size={14} />}
          {isAdding ? 'Adding...' : 'Add Study'}
        </button>
      </div>

      {result && (
        <div
          className={`flex items-center gap-1.5 rounded p-2 text-xs ${
            result.success ? 'bg-success-bg text-success' : 'bg-destructive/10 text-destructive'
          }`}
        >
          {result.success ?
            <CheckIcon size={14} />
          : <AlertCircleIcon size={14} />}
          {result.message}
        </div>
      )}
    </div>
  );
}
