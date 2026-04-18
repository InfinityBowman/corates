/**
 * Billing API functions
 * Handles all billing-related API calls
 */

import { API_BASE } from '@/config/api';

type BillingInterval = 'monthly' | 'yearly';

async function createCheckoutSession(
  tier: string,
  interval: BillingInterval = 'monthly',
): Promise<{ url: string }> {
  const res = await fetch(`${API_BASE}/api/billing/checkout`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tier, interval }),
  });
  const data = (await res.json()) as { url?: string; code?: string; statusCode?: number };
  if (!res.ok) throw data;
  return data as { url: string };
}

async function createPortalSession(): Promise<{ url: string }> {
  const res = await fetch(`${API_BASE}/api/billing/portal`, {
    method: 'POST',
    credentials: 'include',
  });
  const data = (await res.json()) as { url?: string; code?: string; statusCode?: number };
  if (!res.ok) throw data;
  return data as { url: string };
}

export async function redirectToCheckout(
  tier: string,
  interval: BillingInterval = 'monthly',
): Promise<void> {
  const { url } = await createCheckoutSession(tier, interval);
  window.location.href = url;
}

export async function redirectToPortal(): Promise<void> {
  const { url } = await createPortalSession();
  window.location.href = url;
}

async function createSingleProjectCheckout(): Promise<{ url: string; sessionId: string }> {
  const res = await fetch(`${API_BASE}/api/billing/single-project/checkout`, {
    method: 'POST',
    credentials: 'include',
  });
  const data = (await res.json()) as {
    url?: string;
    sessionId?: string;
    code?: string;
    statusCode?: number;
  };
  if (!res.ok) throw data;
  return data as { url: string; sessionId: string };
}

export async function redirectToSingleProjectCheckout(): Promise<void> {
  const { url } = await createSingleProjectCheckout();
  window.location.href = url;
}

export async function getMembers() {
  const res = await fetch(`${API_BASE}/api/billing/members`, { credentials: 'include' });
  const data = (await res.json()) as { members?: unknown[]; count?: number };
  if (!res.ok) throw data;
  return { members: data.members ?? [], count: data.count ?? 0 };
}

export async function startTrial() {
  const res = await fetch(`${API_BASE}/api/billing/trial/start`, {
    method: 'POST',
    credentials: 'include',
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw data;
  return data;
}

export async function validatePlanChange(targetPlan: string) {
  const res = await fetch(
    `${API_BASE}/api/billing/validate-plan-change?targetPlan=${encodeURIComponent(targetPlan)}`,
    { credentials: 'include' },
  );
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw data;
  return data;
}
