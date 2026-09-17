/**
 * Route-level `headers` and `head()` payloads for the /resources pages, built
 * from the page's content record so each route file only names its slug.
 */

import { config } from '@/lib/config';
import { articlePageGraph, collectionPageGraph, type Breadcrumb } from '@/lib/structured-data';
import {
  listResourcePages,
  resourcePageUrl,
  resourcesIndexDateModified,
  RESOURCES_INDEX_PUBLISHED,
  RESOURCES_INDEX_URL,
} from '@/lib/resource-pages';
import type { FaqEntry, ToolContent } from '@/lib/tool-content';
import type { ComparisonContent } from '@/lib/comparison-content';

export const RESOURCE_CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
};

function resourceBreadcrumbs(name: string, url: string): Breadcrumb[] {
  return [
    { name: 'Home', url: config.appUrl },
    { name: 'Resources', url: RESOURCES_INDEX_URL },
    { name, url },
  ];
}

function pageHead(url: string, title: string, description: string, jsonLd: string) {
  return {
    meta: [
      { title },
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: url },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
    ],
    links: [{ rel: 'canonical', href: url }],
    scripts: [{ type: 'application/ld+json', children: jsonLd }],
  };
}

interface ArticlePage {
  slug: string;
  name: string;
  metaTitle: string;
  metaDescription: string;
  datePublished: string;
  dateModified: string;
  about?: { name: string; alternateName?: string }[];
  faq?: FaqEntry[];
}

function articleHead(page: ArticlePage) {
  const url = resourcePageUrl(page.slug);
  const jsonLd = articlePageGraph({
    url,
    name: page.name,
    description: page.metaDescription,
    breadcrumbs: resourceBreadcrumbs(page.name, url),
    about: page.about,
    faq: page.faq,
    datePublished: page.datePublished,
    dateModified: page.dateModified,
  });
  return pageHead(url, page.metaTitle, page.metaDescription, jsonLd);
}

export function toolPageHead(tool: ToolContent) {
  return articleHead({
    ...tool,
    about: [{ name: tool.name, alternateName: tool.fullName }],
  });
}

export function comparisonPageHead(comparison: ComparisonContent) {
  return articleHead({ ...comparison, name: comparison.title });
}

export function resourcesIndexHead(title: string, description: string) {
  const url = RESOURCES_INDEX_URL;
  const jsonLd = collectionPageGraph({
    url,
    name: title,
    description,
    breadcrumbs: resourceBreadcrumbs('Resources', url).slice(0, 2),
    items: listResourcePages().map(page => ({ name: page.name, url: page.url })),
    datePublished: RESOURCES_INDEX_PUBLISHED,
    dateModified: resourcesIndexDateModified(),
  });
  return pageHead(url, title, description, jsonLd);
}
