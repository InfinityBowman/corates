import { MonitorIcon, ClockIcon, LogOutIcon } from 'lucide-react';
import { AdminBox } from '@/components/admin/ui';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/formatDate';
import type { UserSession } from './types';

const parseUserAgent = (ua: string | undefined): { browser: string; os: string } => {
  if (!ua) return { browser: 'Unknown', os: 'Unknown' };
  let browser = 'Unknown';
  let os = 'Unknown';

  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';

  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  return { browser, os };
};

interface UserSessionsProps {
  sessions?: UserSession[];
  loading: boolean;
  onRevoke: (sessionId: string) => void;
  onRevokeAll: () => void;
}

export function UserSessions({ sessions, loading, onRevoke, onRevokeAll }: UserSessionsProps) {
  return (
    <AdminBox className='mb-6'>
      <div className='mb-4 flex items-center justify-between'>
        <h2 className='text-foreground flex items-center text-lg font-semibold'>
          <MonitorIcon className='mr-2 size-5' />
          Active Sessions ({sessions?.length ?? 0})
        </h2>
        {(sessions?.length ?? 0) > 0 && (
          <Button
            variant='ghost'
            size='sm'
            className='text-destructive hover:text-destructive'
            onClick={onRevokeAll}
            disabled={loading}
          >
            <LogOutIcon data-icon='inline-start' />
            Revoke All
          </Button>
        )}
      </div>
      {(sessions?.length ?? 0) > 0 ?
        <div className='flex flex-col gap-3'>
          {sessions!.map(session => {
            const { browser, os } = parseUserAgent(session.userAgent);
            return (
              <div
                key={session.id}
                className='border-border bg-muted flex items-center justify-between rounded-lg border p-4'
              >
                <div className='flex items-center gap-4'>
                  <div className='bg-card flex size-10 items-center justify-center rounded-full'>
                    <MonitorIcon className='text-muted-foreground size-5' />
                  </div>
                  <div>
                    <p className='text-foreground text-sm font-medium'>
                      {browser} on {os}
                    </p>
                    <div className='text-muted-foreground flex items-center gap-3 text-xs'>
                      <span className='flex items-center'>
                        <ClockIcon className='mr-1 size-3' />
                        {formatDateTime(session.createdAt)}
                      </span>
                      {session.ipAddress && <span>IP: {session.ipAddress}</span>}
                    </div>
                    <p className='text-muted-foreground/70 mt-1 text-xs'>
                      Expires: {formatDateTime(session.expiresAt)}
                    </p>
                  </div>
                </div>
                <Button
                  variant='outline'
                  size='xs'
                  className='text-destructive border-destructive/20 hover:bg-destructive/10 hover:text-destructive'
                  onClick={() => onRevoke(session.id)}
                  disabled={loading}
                >
                  <LogOutIcon data-icon='inline-start' />
                  Revoke
                </Button>
              </div>
            );
          })}
        </div>
      : <p className='text-muted-foreground text-sm'>No active sessions</p>}
    </AdminBox>
  );
}
