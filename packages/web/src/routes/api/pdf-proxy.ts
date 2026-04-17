import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { getSession } from '@corates/workers/auth';
import { validatePdfProxyUrl } from '@corates/workers/ssrf-protection';
import { createDomainError, AUTH_ERRORS } from '@corates/shared';

export const handler = async ({ request }: { request: Request }) => {
  const session = await getSession(request, env);
  if (!session) {
    const error = createDomainError(AUTH_ERRORS.REQUIRED, { reason: 'no_user' });
    return Response.json(error, { status: 401 });
  }

  try {
    const body = (await request.json()) as { url?: string };
    const { url } = body;

    if (!url) {
      return Response.json({ error: 'URL is required' }, { status: 400 });
    }

    const validation = validatePdfProxyUrl(url);
    if (!validation.valid) {
      return Response.json(
        { error: validation.error, code: 'SSRF_BLOCKED' },
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
        return Response.json({ error: 'Redirect without location header' }, { status: 502 });
      }

      if (
        location.includes('/login') ||
        location.includes('/auth') ||
        location.includes('/signin') ||
        location.includes('authorization.oauth2') ||
        location.includes('idp.') ||
        location.includes('/sso/')
      ) {
        return Response.json(
          {
            error: 'PDF requires authentication - this article may not be truly open access',
            code: 'AUTH_REQUIRED',
          },
          { status: 403 },
        );
      }

      const redirectUrl = new URL(location, currentUrl);

      const redirectValidation = validatePdfProxyUrl(redirectUrl.href);
      if (!redirectValidation.valid) {
        return Response.json(
          { error: `Redirect blocked: ${redirectValidation.error}`, code: 'SSRF_BLOCKED' },
          { status: 400 },
        );
      }

      currentUrl = redirectUrl.href;
      redirectCount++;
    }

    if (redirectCount >= maxRedirects) {
      return Response.json(
        { error: 'Too many redirects - PDF may require authentication' },
        { status: 502 },
      );
    }

    if (!response || !response.ok) {
      return Response.json(
        { error: `Failed to fetch PDF: ${response?.status} ${response?.statusText}` },
        { status: response?.status || 500 },
      );
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('pdf') && !contentType.includes('octet-stream')) {
      if (contentType.includes('html')) {
        return Response.json(
          {
            error: 'PDF requires authentication - received login page instead',
            code: 'AUTH_REQUIRED',
          },
          { status: 403 },
        );
      }
      return Response.json({ error: 'URL did not return a PDF' }, { status: 400 });
    }

    const pdfData = await response.arrayBuffer();

    return new Response(pdfData, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': pdfData.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error('PDF proxy error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch PDF';
    return Response.json({ error: message }, { status: 500 });
  }
};

export const Route = createFileRoute('/api/pdf-proxy')({
  server: {
    handlers: {
      POST: handler,
    },
  },
});
