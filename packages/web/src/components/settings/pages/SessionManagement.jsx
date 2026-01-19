/**
 * SessionManagement - Active sessions list and revocation controls
 * Part of M1: Session Revocation security feature
 */

import { createSignal, createResource, Show, For, Suspense } from 'solid-js';
import { FiMonitor, FiSmartphone, FiGlobe, FiTrash2, FiLogOut, FiLoader } from 'solid-icons/fi';
import { useBetterAuth } from '@api/better-auth-store.js';
import { showToast } from '@/components/ui/toast';
import {
  Dialog,
  DialogBackdrop,
  DialogPositioner,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogCloseTrigger,
} from '@/components/ui/dialog';
import { handleError } from '@/lib/error-utils.js';

/**
 * Parse user agent string into readable device info
 */
function parseUserAgent(userAgent) {
  if (!userAgent) return { browser: 'Unknown', os: 'Unknown', device: 'desktop' };

  let browser = 'Unknown';
  let os = 'Unknown';
  let device = 'desktop';

  // Detect browser
  if (userAgent.includes('Firefox')) {
    browser = 'Firefox';
  } else if (userAgent.includes('Edg/')) {
    browser = 'Edge';
  } else if (userAgent.includes('Chrome')) {
    browser = 'Chrome';
  } else if (userAgent.includes('Safari')) {
    browser = 'Safari';
  } else if (userAgent.includes('Opera') || userAgent.includes('OPR')) {
    browser = 'Opera';
  }

  // Detect OS
  if (userAgent.includes('Windows')) {
    os = 'Windows';
  } else if (userAgent.includes('Mac OS')) {
    os = 'macOS';
  } else if (userAgent.includes('Linux')) {
    os = 'Linux';
  } else if (userAgent.includes('Android')) {
    os = 'Android';
    device = 'mobile';
  } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    os = userAgent.includes('iPad') ? 'iPadOS' : 'iOS';
    device = 'mobile';
  }

  return { browser, os, device };
}

/**
 * Format relative time string
 */
function formatRelativeTime(date) {
  if (!date) return 'Unknown';

  const now = new Date();
  const then = new Date(date);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return then.toLocaleDateString();
}

/**
 * Mask IP address for privacy (show partial)
 */
function maskIp(ip) {
  if (!ip) return 'Unknown';
  // For IPv4, show first two octets
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.*.*`;
  }
  // For IPv6, truncate
  if (ip.includes(':')) {
    return ip.substring(0, 12) + '...';
  }
  return ip;
}

/**
 * Single session card component
 */
function SessionCard(props) {
  const deviceInfo = () => parseUserAgent(props.session.userAgent);

  return (
    <div
      class={`rounded-lg border p-4 ${
        props.isCurrent ? 'border-primary/30 bg-primary-subtle' : 'border-border bg-muted'
      }`}
    >
      <div class='flex items-start justify-between'>
        <div class='flex items-start space-x-3'>
          {/* Device Icon */}
          <div class={`rounded-full p-2 ${props.isCurrent ? 'bg-primary/10' : 'bg-secondary'}`}>
            <Show
              when={deviceInfo().device === 'mobile'}
              fallback={
                <FiMonitor
                  class={`h-5 w-5 ${props.isCurrent ? 'text-primary' : 'text-secondary-foreground'}`}
                />
              }
            >
              <FiSmartphone
                class={`h-5 w-5 ${props.isCurrent ? 'text-primary' : 'text-secondary-foreground'}`}
              />
            </Show>
          </div>

          {/* Session Info */}
          <div>
            <div class='flex items-center space-x-2'>
              <p class='text-foreground font-medium'>
                {deviceInfo().browser} on {deviceInfo().os}
              </p>
              <Show when={props.isCurrent}>
                <span class='bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium'>
                  Current
                </span>
              </Show>
            </div>
            <div class='text-muted-foreground mt-1 flex items-center space-x-3 text-sm'>
              <span class='flex items-center'>
                <FiGlobe class='mr-1 h-3.5 w-3.5' />
                {maskIp(props.session.ipAddress)}
              </span>
              <span>
                {props.isCurrent ?
                  'Active now'
                : formatRelativeTime(props.session.updatedAt || props.session.createdAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Revoke Button (not for current session) */}
        <Show when={!props.isCurrent}>
          <button
            onClick={() => props.onRevoke(props.session.token)}
            disabled={props.revoking}
            class='text-destructive hover:bg-destructive-subtle flex items-center space-x-1 rounded-md px-3 py-1.5 text-sm font-medium transition disabled:opacity-50'
          >
            <Show when={!props.revoking} fallback={<FiLoader class='h-4 w-4 animate-spin' />}>
              <FiTrash2 class='h-4 w-4' />
            </Show>
            <span>Revoke</span>
          </button>
        </Show>
      </div>
    </div>
  );
}

export default function SessionManagement() {
  const {
    session,
    listActiveSessions,
    revokeSessionByToken,
    revokeAllOtherSessions,
    revokeAllSessions,
  } = useBetterAuth();

  // State
  const [revoking, setRevoking] = createSignal(null); // token being revoked
  const [showRevokeAllDialog, setShowRevokeAllDialog] = createSignal(false);
  const [revokingAll, setRevokingAll] = createSignal(false);

  // Fetch sessions as a resource
  const [sessions, { refetch }] = createResource(listActiveSessions);

  // Get current session token for comparison
  const currentToken = () => session()?.data?.session?.token;

  // Deduplicate sessions by device (userAgent + IP), keeping the most recent
  // and always preserving the current session
  const dedupedSessions = () => {
    const rawSessions = sessions() || [];
    const current = currentToken();

    // Group by device fingerprint (userAgent + IP)
    const byDevice = new Map();

    for (const s of rawSessions) {
      const key = `${s.userAgent || 'unknown'}|${s.ipAddress || 'unknown'}`;
      const existing = byDevice.get(key);

      // Always keep the current session
      if (s.token === current) {
        byDevice.set(key, s);
        continue;
      }

      // Skip if this device already has the current session
      if (existing?.token === current) {
        continue;
      }

      // Keep the most recently updated/created session
      if (!existing) {
        byDevice.set(key, s);
      } else {
        const existingTime = new Date(existing.updatedAt || existing.createdAt).getTime();
        const newTime = new Date(s.updatedAt || s.createdAt).getTime();
        if (newTime > existingTime) {
          byDevice.set(key, s);
        }
      }
    }

    // Sort: current session first, then by most recent
    return Array.from(byDevice.values()).sort((a, b) => {
      if (a.token === current) return -1;
      if (b.token === current) return 1;
      const aTime = new Date(a.updatedAt || a.createdAt).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt).getTime();
      return bTime - aTime;
    });
  };

  // Revoke a single session
  async function handleRevokeSession(token) {
    setRevoking(token);
    try {
      await revokeSessionByToken(token);
      showToast.success('Session revoked successfully');
      refetch();
    } catch (err) {
      await handleError(err, {
        showToast: true,
        toastTitle: 'Failed to revoke session',
      });
    } finally {
      setRevoking(null);
    }
  }

  // Revoke all other sessions
  async function handleRevokeOther() {
    setRevokingAll(true);
    try {
      await revokeAllOtherSessions();
      showToast.success('All other sessions revoked');
      refetch();
    } catch (err) {
      await handleError(err, {
        showToast: true,
        toastTitle: 'Failed to revoke sessions',
      });
    } finally {
      setRevokingAll(false);
    }
  }

  // Revoke ALL sessions (logout everywhere)
  async function handleRevokeAll() {
    setRevokingAll(true);
    try {
      await revokeAllSessions();
      showToast.success('Logged out from all devices');
      // User will be redirected to login by auth state change
    } catch (err) {
      await handleError(err, {
        showToast: true,
        toastTitle: 'Failed to logout from all devices',
      });
      setRevokingAll(false);
    }
    setShowRevokeAllDialog(false);
  }

  return (
    <div class='space-y-4'>
      <div class='flex items-center justify-between'>
        <div>
          <p class='text-foreground font-medium'>Active Sessions</p>
          <p class='text-muted-foreground text-sm'>
            Manage devices where you're currently signed in.
          </p>
        </div>
      </div>

      {/* Sessions List */}
      <Suspense
        fallback={
          <div class='text-muted-foreground flex items-center justify-center py-8'>
            <FiLoader class='mr-2 h-5 w-5 animate-spin' />
            <span>Loading sessions...</span>
          </div>
        }
      >
        <Show
          when={!sessions.error}
          fallback={
            <div class='border-destructive/30 bg-destructive-subtle text-destructive rounded-lg border p-4 text-sm'>
              Failed to load sessions. Please try again.
            </div>
          }
        >
          <div class='space-y-3'>
            <For each={dedupedSessions()}>
              {sessionItem => (
                <SessionCard
                  session={sessionItem}
                  isCurrent={sessionItem.token === currentToken()}
                  revoking={revoking() === sessionItem.token}
                  onRevoke={handleRevokeSession}
                />
              )}
            </For>
          </div>

          {/* Action Buttons */}
          <Show when={dedupedSessions().length > 1}>
            <div class='border-border mt-4 flex flex-wrap gap-3 border-t pt-4'>
              <button
                onClick={handleRevokeOther}
                disabled={revokingAll()}
                class='bg-muted text-secondary-foreground hover:bg-secondary flex items-center space-x-2 rounded-md px-4 py-2 text-sm font-medium transition disabled:opacity-50'
              >
                <FiLogOut class='h-4 w-4' />
                <span>{revokingAll() ? 'Revoking...' : 'Sign out other sessions'}</span>
              </button>

              <button
                onClick={() => setShowRevokeAllDialog(true)}
                disabled={revokingAll()}
                class='bg-destructive-subtle text-destructive hover:bg-destructive/10 flex items-center space-x-2 rounded-md px-4 py-2 text-sm font-medium transition disabled:opacity-50'
              >
                <FiTrash2 class='h-4 w-4' />
                <span>Sign out everywhere</span>
              </button>
            </div>
          </Show>

          {/* Single session message */}
          <Show when={dedupedSessions().length === 1}>
            <p class='text-muted-foreground mt-2 text-sm'>This is your only active session.</p>
          </Show>
        </Show>
      </Suspense>

      {/* Confirmation Dialog for Sign Out Everywhere */}
      <Dialog open={showRevokeAllDialog()} onOpenChange={setShowRevokeAllDialog}>
        <DialogBackdrop />
        <DialogPositioner>
          <DialogContent class='max-w-md p-6'>
            <DialogTitle>Sign out everywhere?</DialogTitle>
            <DialogDescription class='mt-2'>
              This will sign you out from all devices, including this one. You'll need to sign in
              again to continue.
            </DialogDescription>

            <div class='mt-6 flex justify-end space-x-3'>
              <DialogCloseTrigger class='bg-muted text-secondary-foreground hover:bg-secondary rounded-md px-4 py-2 text-sm font-medium transition'>
                Cancel
              </DialogCloseTrigger>
              <button
                onClick={handleRevokeAll}
                disabled={revokingAll()}
                class='bg-destructive hover:bg-destructive/90 rounded-md px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50'
              >
                {revokingAll() ? 'Signing out...' : 'Sign out everywhere'}
              </button>
            </div>
          </DialogContent>
        </DialogPositioner>
      </Dialog>
    </div>
  );
}
