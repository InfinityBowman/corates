/**
 * Local checklist create route - /checklist
 * Shows the create form for a new local (offline) checklist
 */

import { createFileRoute } from '@tanstack/react-router';
import { LocalChecklistView } from '@/components/checklist/LocalChecklistView';

export const Route = createFileRoute('/_app/checklist')({
  component: ChecklistCreatePage,
});

function ChecklistCreatePage() {
  const search = Route.useSearch() as Record<string, string>;
  return <LocalChecklistView searchType={search?.type} />;
}
