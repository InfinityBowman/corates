import { lazy, Suspense, useState } from 'react';
import { useExportDialogStore } from '@/stores/exportDialogStore';

// The dialog pulls in jsPDF and the PDF report builder (~150 KB gzip); load
// it on first open rather than with the dashboard and project pages.
const ExportDialog = lazy(() => import('./ExportDialog').then(m => ({ default: m.ExportDialog })));

export function LazyExportDialog() {
  const isOpen = useExportDialogStore(s => s.isOpen);
  const [opened, setOpened] = useState(false);
  if (isOpen && !opened) setOpened(true);
  if (!opened) return null;
  return (
    <Suspense fallback={null}>
      <ExportDialog />
    </Suspense>
  );
}
