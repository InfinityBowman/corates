/**
 * ImpersonationBanner - Fixed banner shown when admin is impersonating a user
 */

import { useEffect } from 'react';
import { useAdminStore } from '@/stores/adminStore';
import { Button } from '@/components/ui/button';

export function ImpersonationBanner() {
  const isImpersonating = useAdminStore(s => s.isImpersonating);
  const impersonatedBy = useAdminStore(s => s.impersonatedBy);
  const checkImpersonationStatus = useAdminStore(s => s.checkImpersonationStatus);
  const stopImpersonation = useAdminStore(s => s.stopImpersonation);

  useEffect(() => {
    checkImpersonationStatus();
  }, [checkImpersonationStatus]);

  if (!isImpersonating) return null;

  return (
    <div className='fixed inset-x-0 top-0 z-[100] flex items-center justify-between bg-amber-500 px-4 py-2 text-sm font-medium text-white'>
      <span>
        You are impersonating a user
        {impersonatedBy && <span className='ml-1 opacity-75'>(by {impersonatedBy})</span>}
      </span>
      <Button
        size='xs'
        onClick={stopImpersonation}
        className='bg-white/20 px-3 font-semibold text-white hover:bg-white/30'
      >
        Stop Impersonating
      </Button>
    </div>
  );
}
