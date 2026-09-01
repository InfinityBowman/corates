/**
 * Mail scanners prefetch GET links and burn the single-use verify token, so
 * emails link to the frontend /verify-link page, which requires a click.
 */
export function buildMagicLinkInterstitialUrl(verifyUrl: string, token: string): string {
  const parsed = new URL(verifyUrl);
  const callbackURL = parsed.searchParams.get('callbackURL') || '/';

  // callbackURL carries the frontend origin, which differs from the auth origin in local dev
  let frontendOrigin: string;
  try {
    frontendOrigin = new URL(callbackURL).origin;
  } catch {
    frontendOrigin = parsed.origin;
  }

  const interstitial = new URL('/verify-link', frontendOrigin);
  interstitial.searchParams.set('token', token);
  interstitial.searchParams.set('callbackURL', callbackURL);
  return interstitial.toString();
}
