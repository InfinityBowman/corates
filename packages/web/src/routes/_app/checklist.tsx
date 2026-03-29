/**
 * Local checklist layout route - /checklist
 * Parent layout for checklist create (index) and view ($checklistId) routes.
 */

import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/_app/checklist')({
  component: ChecklistLayout,
});

function ChecklistLayout() {
  return <Outlet />;
}
