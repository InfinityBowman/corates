import { validatePdfProxyUrl } from '@corates/workers/ssrf-protection';
import { throwDomainError, FILE_ERRORS, SYSTEM_ERRORS, VALIDATION_ERRORS } from '@corates/shared';
import type { Session } from '@/server/middleware/auth';

export async function proxyPdfFetch(
  _session: Session,
  params: { url: string },
): Promise<ArrayBuffer> {
  const { url } = params;

  if (!url) {
    throwDomainError(VALIDATION_ERRORS.FIELD_REQUIRED, { field: 'url' });
  }

  const validation = validatePdfProxyUrl(url);
  if (!validation.valid) {
    throwDomainError(VALIDATION_ERRORS.INVALID_INPUT, {
      field: 'url',
      reason: validation.error,
    });
  }

  let response: Response | undefined;
  let redirectCount = 0;
  const maxRedirects = 5;
  let currentUrl = url;

  while (redirectCount < maxRedirects) {
    response = await fetch(currentUrl, {
      headers: {
        'User-Agent': 'CoRATES/1.0 (Research Tool; mailto:support@corates.app)',
        Accept: 'application/pdf,*/*',
      },
      redirect: 'manual',
    });

    if (![301, 302, 303, 307, 308].includes(response.status)) {
      break;
    }

    const location = response.headers.get('location');
    if (!location) {
      throwDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
        reason: 'Redirect without location header',
      });
    }

    if (
      location.includes('/login') ||
      location.includes('/auth') ||
      location.includes('/signin') ||
      location.includes('authorization.oauth2') ||
      location.includes('idp.') ||
      location.includes('/sso/')
    ) {
      throwDomainError(FILE_ERRORS.ACCESS_RESTRICTED, {
        reason: 'PDF requires authentication - this article may not be truly open access',
      });
    }

    const redirectUrl = new URL(location, currentUrl);

    const redirectValidation = validatePdfProxyUrl(redirectUrl.href);
    if (!redirectValidation.valid) {
      throwDomainError(VALIDATION_ERRORS.INVALID_INPUT, {
        field: 'redirect_url',
        reason: redirectValidation.error,
      });
    }

    currentUrl = redirectUrl.href;
    redirectCount++;
  }

  if (redirectCount >= maxRedirects) {
    throwDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
      reason: 'Too many redirects - PDF may require authentication',
    });
  }

  if (!response || !response.ok) {
    throwDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
      reason: `Failed to fetch PDF: ${response?.status} ${response?.statusText}`,
    });
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('pdf') && !contentType.includes('octet-stream')) {
    if (contentType.includes('html')) {
      throwDomainError(FILE_ERRORS.ACCESS_RESTRICTED, {
        reason: 'PDF requires authentication - received login page instead',
      });
    }
    throwDomainError(FILE_ERRORS.INVALID_TYPE, {
      expected: 'application/pdf',
      received: contentType,
    });
  }

  return response.arrayBuffer();
}
