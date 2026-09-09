import { MonitorIcon, LogOutIcon } from 'lucide-react';
import { AdminEmpty, AdminPanel } from '@/components/admin/ui';
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
  const rows = sessions ?? [];

  return (
    <AdminPanel
      title={`Active Sessions (${rows.length})`}
      bodyClassName='divide-border divide-y'
      action={
        rows.length > 0 && (
          <Button
            variant='ghost'
            size='sm'
            className='text-destructive hover:text-destructive'
            onClick={onRevokeAll}
            disabled={loading}
          >
            <LogOutIcon data-icon='inline-start' />
            Revoke all
          </Button>
        )
      }
    >
      {rows.length === 0 ?
        <AdminEmpty title='No active sessions' />
      : rows.map(session => {
          const { browser, os } = parseUserAgent(session.userAgent);
          return (
            <div key={session.id} className='flex items-center gap-3 px-4 py-3'>
              <span className='bg-muted inline-flex size-7 shrink-0 items-center justify-center rounded-full'>
                <MonitorIcon className='text-muted-foreground size-4' />
              </span>
              <div className='min-w-0 flex-1'>
                <p className='text-foreground text-[13px] font-medium'>
                  {browser} on {os}
                </p>
                <p className='text-muted-foreground text-xs'>
                  Started {formatDateTime(session.createdAt)} - expires{' '}
                  {formatDateTime(session.expiresAt)}
                  {session.ipAddress && ` - ${session.ipAddress}`}
                </p>
              </div>
              <Button
                variant='ghost'
                size='sm'
                className='text-destructive hover:text-destructive shrink-0'
                onClick={() => onRevoke(session.id)}
                disabled={loading}
              >
                Revoke
              </Button>
            </div>
          );
        })
      }
    </AdminPanel>
  );
}
