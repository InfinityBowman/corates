export default {
  async fetch(request, env) {
    // Try to get the static asset
    const asset = await env.ASSETS.fetch(request);

    // If asset found (not 404), return it
    if (asset.status !== 404) {
      return asset;
    }

    // For 404s, serve app.html (the web app SPA shell)
    const appHtmlUrl = new URL('/app.html', request.url);
    const appHtml = await env.ASSETS.fetch(appHtmlUrl);

    // If app.html doesn't exist, return the original 404
    if (appHtml.status === 404) {
      return asset;
    }

    // Clone headers to make them mutable and return with 200 status
    const headers = new Headers(appHtml.headers);
    headers.set('Content-Type', 'text/html; charset=utf-8');

    return new Response(appHtml.body, {
      status: 200,
      headers,
    });
  },
};
