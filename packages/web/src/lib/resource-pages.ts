/**
 * Every server-rendered page under /resources, in the order the index lists
 * them. The sitemap and the index page's CollectionPage graph both read from
 * here so a new page is registered once.
 */

import { getAllTools } from '@/lib/tool-content';
import { getAllComparisons } from '@/lib/comparison-content';
import type { PageDates } from '@/lib/structured-data';
import {
  RESOURCES_INDEX_PATH,
  RESOURCES_INDEX_PUBLISHED,
  resourcePageUrl,
} from '@/lib/resource-urls';

export {
  RESOURCES_INDEX_PATH,
  RESOURCES_INDEX_PUBLISHED,
  RESOURCES_INDEX_URL,
  resourcePageUrl,
} from '@/lib/resource-urls';

export interface ResourcePage extends PageDates {
  path: string;
  url: string;
  name: string;
}

export function listResourcePages(): ResourcePage[] {
  const tools = getAllTools().map(tool => ({
    path: `${RESOURCES_INDEX_PATH}/${tool.slug}`,
    url: resourcePageUrl(tool.slug),
    name: tool.name,
    datePublished: tool.datePublished,
    dateModified: tool.dateModified,
  }));
  const comparisons = getAllComparisons().map(comparison => ({
    path: `${RESOURCES_INDEX_PATH}/${comparison.slug}`,
    url: resourcePageUrl(comparison.slug),
    name: comparison.title,
    datePublished: comparison.datePublished,
    dateModified: comparison.dateModified,
  }));
  return [...tools, ...comparisons];
}

/** Latest change across the listed pages; dates are YYYY-MM-DD so string order is date order */
export function resourcesIndexDateModified(): string {
  return listResourcePages()
    .map(page => page.dateModified)
    .reduce((latest, date) => (date > latest ? date : latest), RESOURCES_INDEX_PUBLISHED);
}
