export async function getDocsHtml(env) {
  let openapiJson;
  try {
    openapiJson = await import('../openapi.json', { assert: { type: 'json' } });
  } catch {
    openapiJson = null;
  }

  // Test if openapiJson is valid
  let hasOpenapi = true;
  if (!openapiJson || typeof openapiJson !== 'object') {
    hasOpenapi = false;
  }

  const defaultMessage = `Run \`pnpm openapi\` from root to generate /openapi.json.`;
  const openapiMessage = env.OPENAPI_NOT_FOUND_MESSAGE || defaultMessage;
  const escapeHtml = s =>
    String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

  const jsonString = JSON.stringify(openapiJson).replaceAll('</script>', String.raw`<\/script>`);

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Corates API Documentation</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    /* Banner styling for errors/warnings */
    .warning {
      display: none;
      position: sticky;
      top: 12px;
      z-index: 10;
      background: #fff9ed;
      border-left: 4px solid #f0c040;
      color: #333;
      padding: 12px 16px;
      margin: 12px 16px;
      border-radius: 4px;
      font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;
    }

    /* Close button inside the warning banner */
    .warning .close {
      position: absolute;
      right: 8px;
      top: 8px;
      background: transparent;
      border: none;
      color: inherit;
      font-size: 24px;
      font-weight: 100;
      line-height: 1;
      cursor: pointer;
      padding: 4px 6px;
      border-radius: 4px;
    }

    .warning .close:hover {
      background: rgba(0,0,0,0.04);
    }

    /* When we switch to fixed positioning, give it a higher z-index and small shadow */
    .warning.fixed {
      z-index: 10000;
      box-shadow: 0 2px 6px rgba(0,0,0,0.08);
    }
  </style>
</head>
<body>
  <div id="openapi-missing" class="warning"><strong>OpenAPI spec not found.</strong> ${escapeHtml(openapiMessage)}<button class="close" aria-label="Close">&times;</button></div>
  <div id="openapi-auth" class="warning"><strong>Not Authenticated.</strong> ${escapeHtml(env.OPENAPI_NOT_AUTHENTICATED_MESSAGE || `Run \`pnpm dev:front\` to start the frontend and log in`)}<button class="close" aria-label="Close">&times;</button></div>

  <script id="api-reference" type="application/json">${jsonString}</script>
  <script>
    // Pass configuration to Scalar and include openapi messages in the configuration as well
    document.getElementById('api-reference').dataset.configuration = JSON.stringify({
      theme: 'elysiajs',
      showDeveloperTools: 'never',
      hideClientButton: true,
      layout: 'modern',
      defaultHttpClient: { targetKey: 'javascript', clientKey: 'fetch' },
      hiddenClients: ['unirest'],
      metaData: { title: 'Corates API' },
      withCredentials: true,
      authentication: {
        preferredSecurityScheme: 'cookieAuth',
      },
      // Scalar may ignore this, but it's present so custom messages are embedded in the HTML
      openapiNotFoundMessage: ${JSON.stringify(openapiMessage)},
      openapiNotAuthenticatedMessage: ${JSON.stringify(env.OPENAPI_NOT_AUTHENTICATED_MESSAGE || `Log in at http://localhost:5173`)}
    });

    // Inline checks: try fetching the OpenAPI spec and the auth session
    (async function() {
      // OpenAPI availability
      if (!${hasOpenapi}) {
        document.getElementById('openapi-missing').style.display = 'block';
        return;
      }

      const AUTH_CHECK_INTERVAL = 5000; // 5 seconds
      let intervalId;

      // Inline function to check auth
      async function checkAuth() {
        try {
          const s = await fetch('/api/auth/session', {
            cache: 'no-store',
            credentials: 'include',
          });

          if (s.ok) {
            const payload = await s.json().catch(() => null);
            if (payload?.user) {
              // Authenticated -> hide message and stop interval
              document.getElementById('openapi-auth').style.display = 'none';
              clearInterval(intervalId);
            } else {
              // Not authenticated -> show auth message
              document.getElementById('openapi-auth').style.display = 'block';
            }
          } else {
            // Non-200 -> assume not authenticated
            document.getElementById('openapi-auth').style.display = 'block';
          }
        } catch (e) {
          // Network/CORS error -> show auth message
          document.getElementById('openapi-auth').style.display = 'block';
        }
      }

      // Run immediately once
      await checkAuth();

      // Retry every interval
      intervalId = setInterval(checkAuth, AUTH_CHECK_INTERVAL);
    })();

    // Close button behavior for banners
    document.querySelectorAll('.warning .close').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.parentElement.style.display = 'none';
      });
      btn.title = 'Dismiss this warning';
    });

    // Improve sticky behavior: switch to fixed positioning while stuck to avoid repaint jank
    (function() {
      const banners = Array.from(document.querySelectorAll('.warning'));
      banners.forEach(banner => {
        // create a small sentinel element directly before the banner
        const sentinel = document.createElement('div');
        sentinel.className = 'warning-sentinel';
        sentinel.style.cssText = 'display:block; height:1px; width:1px; margin:0; padding:0;';
        banner.parentNode.insertBefore(sentinel, banner);

        const obs = new IntersectionObserver(entries => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              // sentinel visible -> banner in-flow
              banner.classList.remove('fixed');
              banner.style.position = '';
              banner.style.left = '';
              banner.style.width = '';
              banner.style.top = '';
              banner.style.margin = '';
            } else {
              // sentinel not visible -> banner stuck to top -> make fixed
              const rect = banner.getBoundingClientRect();
              banner.classList.add('fixed');
              banner.style.position = 'fixed';
              banner.style.top = '12px';
              banner.style.left = rect.left + 'px';
              banner.style.width = rect.width + 'px';
              banner.style.margin = '0';
            }
          }
        }, { threshold: 0 });

        obs.observe(sentinel);

        // If the banner gets hidden, disconnect observer to avoid work
        const mo = new MutationObserver(() => {
          if (getComputedStyle(banner).display === 'none') {
            obs.disconnect();
            mo.disconnect();
          }
        });
        mo.observe(banner, { attributes: true, attributeFilter: ['style', 'class'] });
      });
    })();
  </script>

  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`;

  return html;
}
