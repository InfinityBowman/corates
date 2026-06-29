/**
 * DevStudyGenerator - Add studies with auto-filled checklists and optional reconciliation
 *
 * Reads project members and outcomes from the project store to populate dropdowns.
 * Calls POST /dev/add-study on the backend to generate the study directly in the Y.Doc.
 */

import { useId, useState } from 'react';
import { PlusIcon, CheckIcon, AlertCircleIcon } from 'lucide-react';
import { useProjectMembersById, useProjectMetaById } from '@/primitives/useProject/reactor';
import { addStudy } from '@/server/functions/dev-tools.functions';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';

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
  const atomMembers = useProjectMembersById(projectId || '');
  const meta = useProjectMetaById(projectId || '');

  const members: MemberEntry[] = (atomMembers as MemberEntry[]) || [];
  const outcomes: OutcomeEntry[] = meta?.outcomes ?? [];

  const [type, setType] = useState('AMSTAR2');
  const [fillMode, setFillMode] = useState('random');
  const [reviewer1, setReviewer1] = useState('');
  const [reviewer2, setReviewer2] = useState('');
  const [outcomeId, setOutcomeId] = useState('__auto__');
  const [reconcile, setReconcile] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  const reconcileId = useId();

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
      const data = (await addStudy({
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

  const triggerClass = 'w-full text-xs';
  const labelClass = 'text-2xs text-muted-foreground font-medium tracking-wide uppercase';
  // The dev panel floats at z-9999; portaled dropdowns must sit above it.
  const contentClass = 'z-10000';

  return (
    <div className='border-border flex flex-col gap-3 border-t pt-3'>
      <h4 className='text-foreground text-xs font-semibold'>Study Generator</h4>

      {members.length < 2 && (
        <Alert variant='warning' className='px-2 py-2'>
          <AlertDescription className='text-xs'>
            Project needs at least 2 members to assign reviewers.
          </AlertDescription>
        </Alert>
      )}

      <div className='flex gap-2'>
        <div className='flex flex-1 flex-col gap-1'>
          <label className={labelClass}>Type</label>
          <Select value={type} onValueChange={setType} disabled={isAdding}>
            <SelectTrigger size='sm' className={triggerClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={contentClass}>
              {CHECKLIST_TYPES.map(t => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='flex flex-1 flex-col gap-1'>
          <label className={labelClass}>Fill Mode</label>
          <Select value={fillMode} onValueChange={setFillMode} disabled={isAdding}>
            <SelectTrigger size='sm' className={triggerClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={contentClass}>
              {FILL_MODES.map(f => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className='flex gap-2'>
        <div className='flex min-w-0 flex-1 flex-col gap-1'>
          <label className={labelClass}>Reviewer 1</label>
          <Select value={reviewer1 || undefined} onValueChange={setReviewer1} disabled={isAdding}>
            <SelectTrigger size='sm' className={triggerClass}>
              <SelectValue placeholder='Select...' />
            </SelectTrigger>
            <SelectContent className={contentClass}>
              {members
                .filter(m => m.userId !== reviewer2)
                .map(m => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {getMemberLabel(m)}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div className='flex min-w-0 flex-1 flex-col gap-1'>
          <label className={labelClass}>Reviewer 2</label>
          <Select value={reviewer2 || undefined} onValueChange={setReviewer2} disabled={isAdding}>
            <SelectTrigger size='sm' className={triggerClass}>
              <SelectValue placeholder='Select...' />
            </SelectTrigger>
            <SelectContent className={contentClass}>
              {members
                .filter(m => m.userId !== reviewer1)
                .map(m => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {getMemberLabel(m)}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {requiresOutcome && (
        <div className='flex flex-col gap-1'>
          <label className={labelClass}>Outcome</label>
          <Select value={outcomeId} onValueChange={setOutcomeId} disabled={isAdding}>
            <SelectTrigger size='sm' className={triggerClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={contentClass}>
              <SelectItem value='__auto__'>Auto-create new outcome</SelectItem>
              {outcomes.map(o => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name || o.id.slice(0, 16)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className='flex items-center gap-3'>
        <label
          htmlFor={reconcileId}
          className='text-muted-foreground flex cursor-pointer items-center gap-1.5 text-xs'
        >
          <Checkbox
            id={reconcileId}
            checked={reconcile}
            onCheckedChange={checked => setReconcile(checked === true)}
            disabled={isAdding}
          />
          Auto-reconcile
        </label>

        <Button
          size='sm'
          className='ml-auto bg-purple-600 text-white hover:bg-purple-700'
          onClick={handleAdd}
          disabled={!canSubmit}
        >
          {isAdding ?
            <Spinner size='sm' variant='white' />
          : <PlusIcon />}
          {isAdding ? 'Adding...' : 'Add Study'}
        </Button>
      </div>

      {result && (
        <Alert
          variant={result.success ? 'success' : 'destructive'}
          className='items-center gap-1.5 px-2 py-2'
        >
          {result.success ?
            <CheckIcon />
          : <AlertCircleIcon />}
          <AlertDescription className='text-xs'>{result.message}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
