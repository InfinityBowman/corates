/**
 * Admin layout route. The app sidebar swaps to the admin sections while on
 * these routes, so this only guards access and frames the page content.
 */

import { useEffect } from 'react';
import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router';
import { ShieldOffIcon } from 'lucide-react';
import { useAdminStore } from '@/stores/adminStore';
import { SectionErrorBoundary } from '@/components/project/SectionErrorBoundary';

export const Route = createFileRoute('/_app/_protected/admin')({
  component: AdminLayout,
});

function AdminLayout() {
  const navigate = useNavigate();
  const { isAdmin, isAdminChecked, checkAdminStatus } = useAdminStore();

  useEffect(() => {
    checkAdminStatus().then(admin => {
      if (!admin) {
        navigate({ to: '/dashboard' });
      }
    });
  }, [checkAdminStatus, navigate]);

  // Nothing renders until the check resolves: pages fetch admin-only data, and
  // a flash of content before the redirect reads as a permissions bug.
  if (!isAdminChecked) {
    return <div className='min-h-0 flex-1' />;
  }

  if (!isAdmin) {
    return (
      <div className='text-muted-foreground flex min-h-100 flex-col items-center justify-center gap-1'>
        <ShieldOffIcon className='mb-3 size-8' />
        <p className='text-foreground text-sm font-medium'>Access denied</p>
        <p className='text-[13px]'>You do not have admin privileges.</p>
      </div>
    );
  }

  return (
    <div className='bg-background flex min-h-0 flex-1 flex-col'>
      <SectionErrorBoundary name='Admin'>
        <Outlet />
      </SectionErrorBoundary>
    </div>
  );
}
