/**
 * Route loaders for the /resources pages. The article content modules are
 * ~140 KB of source; importing them from a route's module scope (for head())
 * put them in the entry chunk every page downloads.
 */

import { notFound } from '@tanstack/react-router';

export async function loadTool(slug: string) {
  const { getToolBySlug } = await import('@/lib/tool-content');
  const tool = getToolBySlug(slug);
  if (!tool) throw notFound();
  return tool;
}

export async function loadComparison(slug: string) {
  const { getComparisonBySlug } = await import('@/lib/comparison-content');
  const comparison = getComparisonBySlug(slug);
  if (!comparison) throw notFound();
  return comparison;
}

/** Just what the index cards and its CollectionPage graph need, not every article body. */
export async function loadResourcesIndex() {
  const [
    { getAllTools },
    { getAllComparisons },
    { listResourcePages, resourcesIndexDateModified },
  ] = await Promise.all([
    import('@/lib/tool-content'),
    import('@/lib/comparison-content'),
    import('@/lib/resource-pages'),
  ]);
  return {
    tools: getAllTools().map(({ id, slug, name, summary }) => ({ id, slug, name, summary })),
    comparisons: getAllComparisons().map(({ slug, title, metaDescription }) => ({
      slug,
      title,
      metaDescription,
    })),
    pages: listResourcePages(),
    dateModified: resourcesIndexDateModified(),
  };
}
