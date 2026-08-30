/** Devices this account is signed in on. */

import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MonitorIcon, SmartphoneIcon, GlobeIcon, Trash2Icon, LogOutIcon } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { showToast } from '@/lib/toast';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { SettingsSection, SettingsRow } from './primitives';

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
    <SettingsRow
      media={
        <div
          className={
            isCurrent ?
              'border-primary/30 bg-primary/10 flex size-9 items-center justify-center rounded-lg border'
            : 'border-border bg-muted flex size-9 items-center justify-center rounded-lg border'
          }
        >
          <DeviceIcon
            className={isCurrent ? 'text-primary size-4.5' : 'text-muted-foreground size-4.5'}
          />
        </div>
      }
      label={
        <span className='flex items-center gap-2'>
          {deviceInfo.browser} on {deviceInfo.os}
          {isCurrent && <Badge variant='info'>This device</Badge>}
        </span>
      }
      description={
        <span className='flex flex-wrap items-center gap-x-2'>
          <span className='inline-flex items-center gap-1'>
            <GlobeIcon className='size-3.5' />
            {maskIp(session.ipAddress)}
          </span>
          <span aria-hidden className='text-border'>
            /
          </span>
          <span>
            {isCurrent ? 'Active now' : formatRelativeTime(session.updatedAt || session.createdAt)}
          </span>
        </span>
      }
    >
      {!isCurrent && (
        <Button
          variant='ghost'
          size='sm'
          onClick={() => onRevoke(session.token)}
          disabled={revoking}
          className='text-muted-foreground hover:text-destructive hover:bg-destructive/10'
        >
          {revoking ?
            <Spinner size='sm' variant='current' />
          : <Trash2Icon className='size-3.5' />}
          Sign out
        </Button>
      )}
    </SettingsRow>
  );
}

export function SessionManagement() {
  const listActiveSessions = useAuthStore(s => s.listActiveSessions);
  const revokeSessionByToken = useAuthStore(s => s.revokeSessionByToken);
  const revokeAllOtherSessions = useAuthStore(s => s.revokeAllOtherSessions);

  const [revokingToken, setRevokingToken] = useState<string | null>(null);
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
        showToast.success('Signed out', 'That device has been signed out.');
        refetch();
      } catch (err) {
        const { handleError } = await import('@/lib/error-utils');
        await handleError(err, { showToast: true, toastTitle: 'Sign out failed' });
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
      showToast.success('Signed out', 'Every other device has been signed out.');
      refetch();
    } catch (err) {
      const { handleError } = await import('@/lib/error-utils');
      await handleError(err, { showToast: true, toastTitle: 'Sign out failed' });
    } finally {
      setRevokingAll(false);
    }
  }, [revokeAllOtherSessions, refetch]);

  return (
    <SettingsSection
      icon={MonitorIcon}
      title='Devices'
      description="Where you're signed in right now. Sign out anything you don't recognize."
      action={
        dedupedSessions.length > 1 ?
          <Button variant='ghost' size='sm' onClick={handleRevokeOther} disabled={revokingAll}>
            <LogOutIcon className='size-3.5' />
            {revokingAll ? 'Signing out...' : 'Sign out other devices'}
          </Button>
        : null
      }
    >
      {isLoading && (
        <div className='text-muted-foreground flex items-center justify-center gap-2 py-8 text-[13px]'>
          <Spinner size='sm' variant='current' />
          Loading devices
        </div>
      )}

      {sessionsError && (
        <div className='p-4'>
          <Alert variant='destructive'>Could not load your devices. Try again in a moment.</Alert>
        </div>
      )}

      {!isLoading &&
        !sessionsError &&
        dedupedSessions.map(sessionItem => (
          <SessionCard
            key={sessionItem.token}
            session={sessionItem}
            isCurrent={sessionItem.token === currentToken}
            revoking={revokingToken === sessionItem.token}
            onRevoke={handleRevokeSession}
          />
        ))}
    </SettingsSection>
  );
}
