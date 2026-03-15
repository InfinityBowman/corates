/**
 * Local checklist view/edit route - /checklist/:checklistId
 * Views and edits a local (offline) checklist stored in IndexedDB
 */

import { createFileRoute } from '@tanstack/react-router';
import { LocalChecklistView } from '@/components/checklist/LocalChecklistView';

export const Route = createFileRoute('/_app/checklist/$checklistId')({
  component: ChecklistViewPage,
});

function ChecklistViewPage() {
  const { checklistId } = Route.useParams();
  return <LocalChecklistView checklistId={checklistId} />;
}
