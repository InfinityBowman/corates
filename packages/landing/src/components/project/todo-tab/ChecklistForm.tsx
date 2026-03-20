/**
 * ChecklistForm - Inline form to add a checklist to a study
 * Includes outcome selector for ROB-2 and ROBINS-I checklist types
 */

import { useState, useMemo, useCallback } from 'react';
import {
  getChecklistTypeOptions,
  getChecklistMetadata,
  DEFAULT_CHECKLIST_TYPE,
  CHECKLIST_TYPES,
} from '@/checklist-registry';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProjectStore } from '@/stores/projectStore';
import { useProjectContext } from '../ProjectContext';

/* eslint-disable no-unused-vars */
interface ChecklistFormProps {
  members: any[];
  currentUserId: string;
  studyChecklists: any[];
  onSubmit: (type: string, assigneeId: string, outcomeId: string | null) => void;
  onCancel: () => void;
  loading: boolean;
}
/* eslint-enable no-unused-vars */

export function ChecklistForm({
  currentUserId,
  studyChecklists,
  onSubmit,
  loading,
}: ChecklistFormProps) {
  const { projectId } = useProjectContext();

  const [type, setType] = useState<string>(DEFAULT_CHECKLIST_TYPE);
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string | null>(null);

  const typeOptions = useMemo(() => getChecklistTypeOptions(), []);

  const meta = useProjectStore(s => s.projects[projectId]?.meta) as any;
  const outcomes: any[] = useMemo(() => meta?.outcomes || [], [meta?.outcomes]);

  const requiresOutcome = type === CHECKLIST_TYPES.ROB2 || type === CHECKLIST_TYPES.ROBINS_I;

  const usedOutcomeIds = useMemo(() => {
    if (!studyChecklists || !requiresOutcome) return new Set<string>();
    const used = new Set<string>();
    for (const checklist of studyChecklists) {
      if (
        checklist.type === type &&
        checklist.assignedTo === currentUserId &&
        checklist.outcomeId
      ) {
        used.add(checklist.outcomeId);
      }
    }
    return used;
  }, [studyChecklists, type, currentUserId, requiresOutcome]);

  const availableOutcomes = useMemo(
    () => outcomes.filter(o => !usedOutcomeIds.has(o.id)),
    [outcomes, usedOutcomeIds],
  );

  // Derive effective outcomeId -- clear if the selected one is no longer available
  const outcomeId =
    selectedOutcomeId && !usedOutcomeIds.has(selectedOutcomeId) ? selectedOutcomeId : null;

  const canSubmit = requiresOutcome ? outcomeId !== null && availableOutcomes.length > 0 : true;

  const hasOutcomeIssue =
    requiresOutcome && (outcomes.length === 0 || availableOutcomes.length === 0);

  const handleTypeChange = useCallback((value: string) => {
    setType(value);
    setSelectedOutcomeId(null);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    onSubmit(type, currentUserId, requiresOutcome ? outcomeId : null);
    setType(DEFAULT_CHECKLIST_TYPE);
    setSelectedOutcomeId(null);
  }, [canSubmit, type, currentUserId, requiresOutcome, outcomeId, onSubmit]);

  return (
    <div className='px-4 py-3'>
      <div className='flex flex-wrap items-end gap-2'>
        <div className='min-w-[180px] flex-1'>
          <Select value={type} onValueChange={handleTypeChange}>
            <SelectTrigger>
              <SelectValue placeholder='Checklist type...' />
            </SelectTrigger>
            <SelectContent>
              {typeOptions.map((option: any) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label} - {option.description}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {requiresOutcome && !hasOutcomeIssue && (
          <div className='min-w-[180px] flex-1'>
            <Select value={outcomeId || ''} onValueChange={v => setSelectedOutcomeId(v || null)}>
              <SelectTrigger>
                <SelectValue placeholder='Select outcome...' />
              </SelectTrigger>
              <SelectContent>
                {availableOutcomes.map((outcome: any) => (
                  <SelectItem key={outcome.id} value={outcome.id}>
                    {outcome.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || !canSubmit}
          className='bg-primary hover:bg-primary/90 shrink-0 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50'
        >
          {loading ? 'Adding...' : 'Add Checklist'}
        </button>
      </div>

      {requiresOutcome && hasOutcomeIssue && outcomes.length === 0 && (
        <div className='mt-2 rounded-lg border border-amber-300 bg-amber-50 p-3'>
          <p className='text-sm font-medium text-amber-800'>No outcomes defined</p>
          <p className='mt-1 text-xs text-amber-700'>
            {(getChecklistMetadata(type) as any)?.name || type} requires an outcome. Add outcomes in
            the All Studies tab first.
          </p>
        </div>
      )}

      {requiresOutcome && hasOutcomeIssue && outcomes.length > 0 && (
        <div className='mt-2 rounded-lg border border-info-border bg-info-bg p-3'>
          <p className='text-sm font-medium text-info-foreground'>All outcomes covered</p>
          <p className='mt-1 text-xs text-info'>
            You already have a {(getChecklistMetadata(type) as any)?.name || type} checklist for
            each available outcome.
          </p>
        </div>
      )}
    </div>
  );
}
