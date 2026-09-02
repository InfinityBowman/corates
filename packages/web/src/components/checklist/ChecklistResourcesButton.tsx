import { InfoIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CHECKLIST_TYPES } from '@/checklist-registry/types';
import { ResourcesPopover, type ChecklistResources } from './ResourcesPopover';
import { AMSTAR2_RESOURCES } from './AMSTAR2Checklist/resources';
import { ROB2_RESOURCES } from './ROB2Checklist/resources';
import { ROBINSI_RESOURCES } from './ROBINSIChecklist/resources';

const RESOURCES_BY_TYPE: Record<string, ChecklistResources> = {
  [CHECKLIST_TYPES.AMSTAR2]: AMSTAR2_RESOURCES,
  [CHECKLIST_TYPES.ROB2]: ROB2_RESOURCES,
  [CHECKLIST_TYPES.ROBINS_I]: ROBINSI_RESOURCES,
};

/**
 * Header trigger for the per-tool guidance popover, shared by the project and
 * local appraisal views so they match the reconcile header.
 */
export function ChecklistResourcesButton({ checklistType }: { checklistType?: string | null }) {
  const resources = checklistType ? RESOURCES_BY_TYPE[checklistType] : undefined;
  if (!resources) return null;

  return (
    <ResourcesPopover resources={resources}>
      <Button variant='outline' size='sm' className='shrink-0'>
        <InfoIcon className='size-4' />
        Resources
      </Button>
    </ResourcesPopover>
  );
}
