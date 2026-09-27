/**
 * /resources URLs and dates with no dependency on the article content, so
 * route head() code can use them without pulling the content into the entry.
 */

import { config } from '@/lib/config';

export const RESOURCES_INDEX_PATH = '/resources';
export const RESOURCES_INDEX_URL = `${config.appUrl}${RESOURCES_INDEX_PATH}`;

// The index has no content module of its own: it went live with the first
// tool pages and changes whenever any page it lists does.
export const RESOURCES_INDEX_PUBLISHED = '2026-03-07';

export function resourcePageUrl(slug: string): string {
  return `${RESOURCES_INDEX_URL}/${slug}`;
}
