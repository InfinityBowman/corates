import { createFileRoute } from '@tanstack/react-router';
import { renderSitemap } from '@/lib/sitemap';
import { RESOURCE_CACHE_HEADERS } from '@/lib/resource-head';

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: () =>
        new Response(renderSitemap(), {
          headers: { 'Content-Type': 'application/xml; charset=utf-8', ...RESOURCE_CACHE_HEADERS },
        }),
    },
  },
});
