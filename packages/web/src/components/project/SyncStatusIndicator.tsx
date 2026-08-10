/**
 * SyncStatusIndicator - Exceptional-state-only sync badge.
 *
 * Silent while healthy (Linear-style): rendering save mechanics on every
 * keystroke trains users to ignore them. The container always renders so
 * e2e can wait on `data-sync-pending` reaching 0 (see shared-steps
 * waitForSynced); the badge inside appears only when unsent work needs
 * attention. No positive "Saved" state on purpose -- the pending count
 * covers mutations only, not the Yjs note lane, so a blanket "saved" claim
 * would overpromise.
 */

import { useEffect, useState } from 'react';
import { CloudOffIcon, CloudAlertIcon } from 'lucide-react';
import { useProjectContext } from './ProjectContext';
import { useProjectStore } from '@/stores/projectStore';
import { Badge } from '@/components/ui/badge';

// How long mutations may sit unconfirmed on a synced connection before the
// pipe-looks-fine-but-work-is-not-landing badge shows.
const ESCALATE_AFTER_MS = 10_000;

export function SyncStatusIndicator() {
  const { projectId } = useProjectContext();
  const connection = useProjectStore(state => state.connections[projectId]);
  const phase = connection?.phase ?? 'idle';
  const pending = connection?.pending ?? 0;

  const hasPending = pending > 0;
  const offline = hasPending && phase !== 'synced';
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    if (!hasPending || phase !== 'synced') {
      setStalled(false);
      return;
    }
    // Keyed on hasPending, not the count, so a draining outbox (3, 2, 1)
    // does not keep resetting the escalation clock.
    const timer = setTimeout(() => setStalled(true), ESCALATE_AFTER_MS);
    return () => clearTimeout(timer);
  }, [hasPending, phase]);

  return (
    <div role='status' data-sync-pending={pending} className='flex items-center'>
      {offline ?
        <Badge variant='warning'>
          <CloudOffIcon className='size-3' />
          Offline, changes pending
        </Badge>
      : stalled ?
        <Badge variant='warning'>
          <CloudAlertIcon className='size-3' />
          Unsent changes
        </Badge>
      : null}
    </div>
  );
}
