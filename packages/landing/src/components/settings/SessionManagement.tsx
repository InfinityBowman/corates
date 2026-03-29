/**
 * SessionManagement - Active sessions list and revocation controls
 */

import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  MonitorIcon,
  SmartphoneIcon,
  GlobeIcon,
  Trash2Icon,
  LogOutIcon,
  LoaderIcon,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/components/ui/toast';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function parseUserAgent(userAgent?: string) {
  if (!userAgent) return { browser: 'Unknown', os: 'Unknown', device: 'desktop' as const };
  let browser = 'Unknown';
  let os = 'Unknown';
  let device: 'desktop' | 'mobile' = 'desktop';

  if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Edg/')) browser = 'Edge';
  else if (userAgent.includes('Chrome')) browser = 'Chrome';
  else if (userAgent.includes('Safari')) browser = 'Safari';
  else if (userAgent.includes('Opera') || userAgent.includes('OPR')) browser = 'Opera';

  if (userAgent.includes('Windows')) os = 'Windows';
  else if (userAgent.includes('Mac OS')) os = 'macOS';
  else if (userAgent.includes('Linux')) os = 'Linux';
  else if (userAgent.includes('Android')) {
    os = 'Android';
    device = 'mobile';
  } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    os = userAgent.includes('iPad') ? 'iPadOS' : 'iOS';
    device = 'mobile';
  }
  return { browser, os, device };
}

function formatRelativeTime(date?: string | number) {
  if (!date) return 'Unknown';
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(date).toLocaleDateString();
}

function maskIp(ip?: string) {
  if (!ip) return 'Unknown';
  const parts = ip.split('.');
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.*.*`;
  if (ip.includes(':')) return ip.substring(0, 12) + '...';
  return ip;
}

interface Session {
  token: string;
  userAgent?: string;
  ipAddress?: string;
  updatedAt?: string;
  createdAt?: string;
}

interface SessionCardProps {
  session: Session;
  isCurrent: boolean;
  revoking: boolean;
  onRevoke: (token: string) => void;
}

function SessionCard({ session, isCurrent, revoking, onRevoke }: SessionCardProps) {
  const deviceInfo = parseUserAgent(session.userAgent);
  const DeviceIcon = deviceInfo.device === 'mobile' ? SmartphoneIcon : MonitorIcon;

  return (
    <div
      className={`rounded-lg border p-4 ${
        isCurrent ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted'
      }`}
    >
      <div className='flex items-start justify-between'>
        <div className='flex items-start gap-3'>
          <div className={`rounded-full p-2 ${isCurrent ? 'bg-primary/10' : 'bg-secondary'}`}>
            <DeviceIcon
              className={`size-5 ${isCurrent ? 'text-primary' : 'text-secondary-foreground'}`}
            />
          </div>
          <div>
            <div className='flex items-center gap-2'>
              <p className='text-foreground font-medium'>
                {deviceInfo.browser} on {deviceInfo.os}
              </p>
              {isCurrent && <Badge variant='default'>Current</Badge>}
            </div>
            <div className='text-muted-foreground mt-1 flex items-center gap-3 text-sm'>
              <span className='flex items-center'>
                <GlobeIcon className='mr-1 size-3.5' />
                {maskIp(session.ipAddress)}
              </span>
              <span>
                {isCurrent ?
                  'Active now'
                : formatRelativeTime(session.updatedAt || session.createdAt)}
              </span>
            </div>
          </div>
        </div>
        {!isCurrent && (
          <button
            onClick={() => onRevoke(session.token)}
            disabled={revoking}
            className='text-destructive hover:bg-destructive/5 flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition disabled:opacity-50'
          >
            {revoking ?
              <LoaderIcon className='size-4 animate-spin' />
            : <Trash2Icon className='size-4' />}
            <span>Revoke</span>
          </button>
        )}
      </div>
    </div>
  );
}

export function SessionManagement() {
  const listActiveSessions = useAuthStore(s => s.listActiveSessions);
  const revokeSessionByToken = useAuthStore(s => s.revokeSessionByToken);
  const revokeAllOtherSessions = useAuthStore(s => s.revokeAllOtherSessions);
  const revokeAllSessions = useAuthStore(s => s.revokeAllSessions);

  const [revokingToken, setRevokingToken] = useState<string | null>(null);
  const [showRevokeAllDialog, setShowRevokeAllDialog] = useState(false);
  const [revokingAll, setRevokingAll] = useState(false);

  const {
    data: sessions,
    isLoading,
    error: sessionsError,
    refetch,
  } = useQuery({
    queryKey: ['sessions', 'active'],
    queryFn: listActiveSessions,
    staleTime: 30_000,
  });

  // TODO(agent): currentToken comparison requires access to the raw session token.
  // Better Auth doesn't expose this easily in React. For now we use a heuristic:
  // the most recently updated session that matches our userAgent is "current".
  const currentToken = useMemo(() => {
    if (!sessions?.length) return null;
    const ua = navigator.userAgent;
    const allSessions = (sessions || []) as Session[];
    const matching = allSessions.filter(s => s.userAgent === ua);
    if (matching.length === 0) return allSessions[0]?.token;
    matching.sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt || 0).getTime() -
        new Date(a.updatedAt || a.createdAt || 0).getTime(),
    );
    return matching[0]?.token;
  }, [sessions]);

  const dedupedSessions = useMemo(() => {
    const rawSessions = (sessions || []) as Session[];
    const byDevice = new Map<string, Session>();

    for (const s of rawSessions) {
      const key = `${s.userAgent || 'unknown'}|${s.ipAddress || 'unknown'}`;
      const existing = byDevice.get(key);
      if (s.token === currentToken) {
        byDevice.set(key, s);
        continue;
      }
      if (existing?.token === currentToken) continue;
      if (!existing) {
        byDevice.set(key, s);
      } else {
        const existingTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
        const newTime = new Date(s.updatedAt || s.createdAt || 0).getTime();
        if (newTime > existingTime) byDevice.set(key, s);
      }
    }

    return Array.from(byDevice.values()).sort((a, b) => {
      if (a.token === currentToken) return -1;
      if (b.token === currentToken) return 1;
      return (
        new Date(b.updatedAt || b.createdAt || 0).getTime() -
        new Date(a.updatedAt || a.createdAt || 0).getTime()
      );
    });
  }, [sessions, currentToken]);

  const handleRevokeSession = useCallback(
    async (token: string) => {
      setRevokingToken(token);
      try {
        await revokeSessionByToken(token);
        showToast.success('Session revoked successfully');
        refetch();
      } catch (err) {
        const { handleError } = await import('@/lib/error-utils');
        await handleError(err, { showToast: true, toastTitle: 'Failed to revoke session' });
      } finally {
        setRevokingToken(null);
      }
    },
    [revokeSessionByToken, refetch],
  );

  const handleRevokeOther = useCallback(async () => {
    setRevokingAll(true);
    try {
      await revokeAllOtherSessions();
      showToast.success('All other sessions revoked');
      refetch();
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(err, { showToast: true, toastTitle: 'Failed to revoke sessions' });
    } finally {
      setRevokingAll(false);
    }
  }, [revokeAllOtherSessions, refetch]);

  const handleRevokeAll = useCallback(async () => {
    setRevokingAll(true);
    try {
      await revokeAllSessions();
      showToast.success('Logged out from all devices');
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(err, { showToast: true, toastTitle: 'Failed to logout from all devices' });
      setRevokingAll(false);
    }
    setShowRevokeAllDialog(false);
  }, [revokeAllSessions]);

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex items-center justify-between'>
        <div>
          <p className='text-foreground font-medium'>Active Sessions</p>
          <p className='text-muted-foreground text-sm'>
            Manage devices where you&apos;re currently signed in.
          </p>
        </div>
      </div>

      {isLoading && (
        <div className='text-muted-foreground flex items-center justify-center py-8'>
          <LoaderIcon className='mr-2 size-5 animate-spin' />
          <span>Loading sessions...</span>
        </div>
      )}

      {sessionsError && (
        <Alert variant='destructive'>Failed to load sessions. Please try again.</Alert>
      )}

      {!isLoading && !sessionsError && (
        <>
          <div className='flex flex-col gap-3'>
            {dedupedSessions.map((sessionItem: any) => (
              <SessionCard
                key={sessionItem.token}
                session={sessionItem}
                isCurrent={sessionItem.token === currentToken}
                revoking={revokingToken === sessionItem.token}
                onRevoke={handleRevokeSession}
              />
            ))}
          </div>

          {dedupedSessions.length > 1 && (
            <>
              <Separator className='mt-4' />
              <div className='mt-4 flex flex-wrap gap-3'>
                <button
                  onClick={handleRevokeOther}
                  disabled={revokingAll}
                  className='bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition disabled:opacity-50'
                >
                  <LogOutIcon className='size-4' />
                  <span>{revokingAll ? 'Revoking...' : 'Sign out other sessions'}</span>
                </button>

                <button
                  onClick={() => setShowRevokeAllDialog(true)}
                  disabled={revokingAll}
                  className='text-destructive hover:bg-destructive/10 bg-destructive/10 flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition disabled:opacity-50'
                >
                  <Trash2Icon className='size-4' />
                  <span>Sign out everywhere</span>
                </button>
              </div>
            </>
          )}

          {dedupedSessions.length === 1 && (
            <p className='text-muted-foreground mt-2 text-sm'>This is your only active session.</p>
          )}
        </>
      )}

      <AlertDialog open={showRevokeAllDialog} onOpenChange={setShowRevokeAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out everywhere?</AlertDialogTitle>
            <AlertDialogDescription>
              This will sign you out from all devices, including this one. You&apos;ll need to sign
              in again to continue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokingAll}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant='destructive'
              disabled={revokingAll}
              onClick={handleRevokeAll}
            >
              {revokingAll ? 'Signing out...' : 'Sign out everywhere'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
