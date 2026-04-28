import { validatePdfProxyUrl } from '@corates/workers/ssrf-protection';
import {
  createDomainError,
  AUTH_ERRORS,
  FILE_ERRORS,
  SYSTEM_ERRORS,
  VALIDATION_ERRORS,
} from '@corates/shared';
import type { Session } from '@/server/middleware/auth';

export async function proxyPdfFetch(
  _session: Session,
  params: { url: string },
): Promise<ArrayBuffer> {
  const { url } = params;

  if (!url) {
    throw Response.json(createDomainError(VALIDATION_ERRORS.FIELD_REQUIRED, { field: 'url' }), {
      status: 400,
    });
  }

  const validation = validatePdfProxyUrl(url);
  if (!validation.valid) {
    throw Response.json(
      createDomainError(VALIDATION_ERRORS.INVALID_INPUT, {
        field: 'url',
        reason: validation.error,
      }),
      { status: 400 },
    );
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
      throw Response.json(
        createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
          reason: 'Redirect without location header',
        }),
        { status: 502 },
      );
    }

    if (
      location.includes('/login') ||
      location.includes('/auth') ||
      location.includes('/signin') ||
      location.includes('authorization.oauth2') ||
      location.includes('idp.') ||
      location.includes('/sso/')
    ) {
      throw Response.json(
        createDomainError(AUTH_ERRORS.REQUIRED, {
          reason: 'PDF requires authentication - this article may not be truly open access',
        }),
        { status: 403 },
      );
    }

    const redirectUrl = new URL(location, currentUrl);

    const redirectValidation = validatePdfProxyUrl(redirectUrl.href);
    if (!redirectValidation.valid) {
      throw Response.json(
        createDomainError(VALIDATION_ERRORS.INVALID_INPUT, {
          field: 'redirect_url',
          reason: redirectValidation.error,
        }),
        { status: 400 },
      );
    }

    currentUrl = redirectUrl.href;
    redirectCount++;
  }

  if (redirectCount >= maxRedirects) {
    throw Response.json(
      createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
        reason: 'Too many redirects - PDF may require authentication',
      }),
      { status: 502 },
    );
  }

  if (!response || !response.ok) {
    throw Response.json(
      createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
        reason: `Failed to fetch PDF: ${response?.status} ${response?.statusText}`,
      }),
      { status: response?.status || 500 },
    );
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('pdf') && !contentType.includes('octet-stream')) {
    if (contentType.includes('html')) {
      throw Response.json(
        createDomainError(AUTH_ERRORS.REQUIRED, {
          reason: 'PDF requires authentication - received login page instead',
        }),
        { status: 403 },
      );
    }
    throw Response.json(
      createDomainError(FILE_ERRORS.INVALID_TYPE, {
        expected: 'application/pdf',
        received: contentType,
      }),
      { status: 400 },
    );
  }

  return response.arrayBuffer();
}
