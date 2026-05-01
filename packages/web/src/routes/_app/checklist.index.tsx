/**
 * Local checklist create route - /checklist (index)
 * Shows the create form for a new local (offline) checklist
 */

import { createFileRoute } from '@tanstack/react-router';
import { LocalChecklistView } from '@/components/checklist/LocalChecklistView';

export const Route = createFileRoute('/_app/checklist/')({
  validateSearch: (search: Record<string, unknown>): { type?: string } => ({
    type: typeof search.type === 'string' ? search.type : undefined,
  }),
  component: ChecklistCreatePage,
});

function ChecklistCreatePage() {
  const { type } = Route.useSearch();
  return <LocalChecklistView searchType={type} />;
}
