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
import { useProjectOutcomes } from '@/project/workspace-data';
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
  const { projectId, setOutcomesSheetOpen } = useProjectContext();

  const [type, setType] = useState<string>(DEFAULT_CHECKLIST_TYPE);
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string | null>(null);

  const typeOptions = useMemo(() => getChecklistTypeOptions(), []);

  const outcomes = useProjectOutcomes(projectId);

  const requiresOutcome = type === CHECKLIST_TYPES.ROB2 || type === CHECKLIST_TYPES.ROBINS_I;
  const typeName = getChecklistMetadata(type).shortName;

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

  const unusedCount = outcomes.filter(o => !usedOutcomeIds.has(o.id)).length;

  // Derive effective outcomeId -- clear if the selected one is no longer available
  const outcomeId =
    selectedOutcomeId && !usedOutcomeIds.has(selectedOutcomeId) ? selectedOutcomeId : null;

  const canSubmit = requiresOutcome ? outcomeId !== null : true;

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
              <SelectValue placeholder='Choose an appraisal tool...' />
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

        {requiresOutcome && outcomes.length > 0 && (
          <div className='min-w-45 flex-1'>
            <Select value={outcomeId || ''} onValueChange={v => setSelectedOutcomeId(v || null)}>
              <SelectTrigger>
                <SelectValue placeholder='Select outcome...' />
              </SelectTrigger>
              <SelectContent>
                {outcomes.map((outcome: any) => {
                  const used = usedOutcomeIds.has(outcome.id);
                  return (
                    <SelectItem key={outcome.id} value={outcome.id} disabled={used}>
                      {used ?
                        `${outcome.name} -- Already has a ${typeName} checklist`
                      : outcome.name}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        )}

        <Button onClick={handleSubmit} disabled={loading || !canSubmit}>
          {loading ? 'Adding...' : 'Add appraisal'}
        </Button>
      </div>

      {requiresOutcome && outcomes.length === 0 && (
        <div className='border-warning-border bg-warning-bg mt-2 rounded-lg border p-3'>
          <p className='text-warning-foreground text-sm font-medium'>No outcomes yet</p>
          <p className='text-warning mt-1 text-xs'>
            A {getChecklistMetadata(type).name} checklist is completed once per outcome, so add at
            least one outcome first. Open{' '}
            <Button
              variant='link'
              size='xs'
              className='text-warning h-auto p-0 text-xs underline'
              onClick={() => setOutcomesSheetOpen(true)}
            >
              Outcomes
            </Button>{' '}
            in the project header.
          </p>
        </div>
      )}

      {requiresOutcome && outcomes.length > 0 && unusedCount === 0 && (
        <div className='border-info-border bg-info-bg mt-2 rounded-lg border p-3'>
          <p className='text-info-foreground text-sm font-medium'>All outcomes covered</p>
          <p className='text-info mt-1 text-xs'>
            You already have a {getChecklistMetadata(type).name} checklist for every outcome in this
            project. Add another outcome to start a new one.
          </p>
        </div>
      )}
    </div>
  );
}
