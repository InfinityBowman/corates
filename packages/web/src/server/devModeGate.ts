// Shared DEV_MODE gate for /api/test/* e2e seed endpoints. Returns a 403
// Response when disabled so callers can `if (gated) return gated;`.

export function devModeGate(env: { DEV_MODE?: boolean }): Response | null {
  if (!env.DEV_MODE) {
    return Response.json({ error: 'Test endpoints disabled' }, { status: 403 });
  }
  return null;
}
