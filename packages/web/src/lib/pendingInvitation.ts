/**
 * The invitation a visitor is carrying while they leave /invite/$token to
 * sign in or sign up. Set when they leave, consumed when they return, and kept
 * in sessionStorage so it cannot outlive the tab and turn an unrelated later
 * sign-in into an invitation flow.
 */

const KEY = 'pendingInvitationToken';

export function getPendingInvitationToken(): string | null {
  return sessionStorage.getItem(KEY);
}

export function setPendingInvitationToken(token: string) {
  sessionStorage.setItem(KEY, token);
}

export function clearPendingInvitationToken() {
  sessionStorage.removeItem(KEY);
}
