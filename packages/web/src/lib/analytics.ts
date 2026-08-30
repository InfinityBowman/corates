/**
 * Thin wrapper around the self-hosted Plausible script loaded in __root.tsx.
 * Use for product usage events; safe to call anywhere (no-ops when the
 * script is blocked or absent).
 *
 * Events are mirrored to Loki as `client.*` entries so the product-health
 * dashboard can chart usage next to the client failure events. Plausible stays
 * the system of record for counts: the Loki copy is production-only, batched,
 * rate limited and sanitized, so it undercounts.
 */

import { clientLogger } from '@/lib/clientLogger';

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: Record<string, string> }) => void;
  }
}

/** `Checklist:OutcomeChanged` -> `client.checklist.outcome_changed` */
function logName(event: string): string {
  const segments = event
    .split(':')
    .map(segment => segment.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase());
  return `client.${segments.join('.')}`;
}

export function track(event: string, props?: Record<string, string>): void {
  window.plausible?.(event, props ? { props } : undefined);
  clientLogger.info(logName(event), props);
}
