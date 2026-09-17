/**
 * Renders /sitemap.xml from the page registry so a resource page's lastmod is
 * the dateModified its content record already carries. Marketing and legal
 * pages have no content module, so their lastmod is set here by hand: bump it
 * when the page's copy or meta changes.
 */

import { config } from '@/lib/config';
import {
  listResourcePages,
  resourcesIndexDateModified,
  RESOURCES_INDEX_PATH,
} from '@/lib/resource-pages';

type ChangeFrequency = 'weekly' | 'monthly' | 'yearly';

export interface SitemapEntry {
  path: string;
  lastmod: string;
  changefreq: ChangeFrequency;
  priority: string;
}

const STATIC_PAGES: SitemapEntry[] = [
  { path: '/', lastmod: '2026-09-01', changefreq: 'weekly', priority: '1.0' },
  { path: '/about', lastmod: '2026-09-01', changefreq: 'monthly', priority: '0.8' },
  { path: '/contact', lastmod: '2026-09-01', changefreq: 'monthly', priority: '0.6' },
  { path: '/pricing', lastmod: '2026-09-01', changefreq: 'weekly', priority: '0.9' },
  { path: '/privacy', lastmod: '2026-09-01', changefreq: 'yearly', priority: '0.3' },
  { path: '/security', lastmod: '2026-09-01', changefreq: 'yearly', priority: '0.4' },
  { path: '/security/disclosure', lastmod: '2026-09-07', changefreq: 'yearly', priority: '0.3' },
  { path: '/terms', lastmod: '2026-09-01', changefreq: 'yearly', priority: '0.3' },
];

export function sitemapEntries(): SitemapEntry[] {
  const resources: SitemapEntry[] = [
    {
      path: RESOURCES_INDEX_PATH,
      lastmod: resourcesIndexDateModified(),
      changefreq: 'monthly',
      priority: '0.8',
    },
    ...listResourcePages().map(page => ({
      path: page.path,
      lastmod: page.dateModified,
      changefreq: 'monthly' as const,
      priority: '0.7',
    })),
  ];
  return [...STATIC_PAGES, ...resources].sort((a, b) => a.path.localeCompare(b.path));
}

export function renderSitemap(baseUrl: string = config.appUrl): string {
  const urls = sitemapEntries()
    .map(
      entry =>
        `  <url>\n` +
        `    <loc>${baseUrl}${entry.path}</loc>\n` +
        `    <lastmod>${entry.lastmod}</lastmod>\n` +
        `    <changefreq>${entry.changefreq}</changefreq>\n` +
        `    <priority>${entry.priority}</priority>\n` +
        `  </url>`,
    )
    .join('\n');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    `${urls}\n` +
    '</urlset>\n'
  );
}
