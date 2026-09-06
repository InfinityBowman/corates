import { apiFetch } from '@/lib/apiFetch';

export async function connectGoogleAccount(callbackUrl?: string): Promise<void> {
  const data = await apiFetch.post<{ url?: string }>('/api/auth/link-social', {
    provider: 'google',
    callbackURL: callbackUrl || window.location.href,
    // Requested here instead of at sign-in so only Drive users see the Drive consent
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });

  if (data.url) {
    window.location.href = data.url;
  } else {
    throw new Error('No redirect URL received from auth server');
  }
}
