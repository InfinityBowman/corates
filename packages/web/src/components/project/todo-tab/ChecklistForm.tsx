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
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProjectMetaById } from '@/primitives/useProject/reactor';
import { useProjectContext } from '../ProjectContext';

interface ChecklistFormProps {
  members: any[];
  currentUserId: string;
  studyChecklists: any[];
  onSubmit: (type: string, assigneeId: string, outcomeId: string | null) => void;
  onCancel: () => void;
  loading: boolean;
}

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

  const meta = useProjectMetaById(projectId);
  const outcomes = useMemo(() => meta?.outcomes ?? [], [meta?.outcomes]);

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
        <div className='min-w-45 flex-1'>
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
          <div className='min-w-45 flex-1'>
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

        <Button onClick={handleSubmit} disabled={loading || !canSubmit}>
          {loading ? 'Adding...' : 'Add Checklist'}
        </Button>
      </div>

      {requiresOutcome && hasOutcomeIssue && outcomes.length === 0 && (
        <div className='border-warning-border bg-warning-bg mt-2 rounded-lg border p-3'>
          <p className='text-warning-foreground text-sm font-medium'>No outcomes defined</p>
          <p className='text-warning mt-1 text-xs'>
            {(getChecklistMetadata(type) as any)?.name || type} requires an outcome. Add outcomes in
            the All Studies tab first.
          </p>
        </div>
      )}

      {requiresOutcome && hasOutcomeIssue && outcomes.length > 0 && (
        <div className='border-info-border bg-info-bg mt-2 rounded-lg border p-3'>
          <p className='text-info-foreground text-sm font-medium'>All outcomes covered</p>
          <p className='text-info mt-1 text-xs'>
            You already have a {(getChecklistMetadata(type) as any)?.name || type} checklist for
            each available outcome.
          </p>
        </div>
      )}
    </div>
  );
}
