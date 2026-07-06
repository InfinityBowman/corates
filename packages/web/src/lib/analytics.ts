/**
 * Thin wrapper around the self-hosted Plausible script loaded in __root.tsx.
 * Use for product usage events; safe to call anywhere (no-ops when the
 * script is blocked or absent).
 */

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: Record<string, string> }) => void;
  }
}

export function track(event: string, props?: Record<string, string>): void {
  window.plausible?.(event, props ? { props } : undefined);
}
