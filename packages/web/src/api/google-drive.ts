import { apiFetch } from '@/lib/apiFetch';

export async function connectGoogleAccount(callbackUrl?: string): Promise<void> {
  const data = await apiFetch.post<{ url?: string }>('/api/auth/link-social', {
    provider: 'google',
    callbackURL: callbackUrl || window.location.href,
    // Requested here instead of at sign-in so only Drive users see the Drive consent
    scopes: ['https://www.googleapis.com/auth/drive.file'],
    // Google only returns a refresh token on a fresh consent, so a reconnect
    // after expiry or disconnect must force the consent screen or the new
    // access token dies after an hour with no way to renew it
    additionalParams: { prompt: 'consent' },
  });

  if (data.url) {
    window.location.href = data.url;
  } else {
    throw new Error('No redirect URL received from auth server');
  }
}
