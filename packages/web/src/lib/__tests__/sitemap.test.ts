import { describe, expect, it } from 'vitest';
import { renderSitemap, sitemapEntries } from '@/lib/sitemap';
import { listResourcePages, resourcesIndexDateModified } from '@/lib/resource-pages';
import { getAllTools } from '@/lib/tool-content';
import { getAllComparisons } from '@/lib/comparison-content';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

describe('resource page dates', () => {
  it('are calendar days with the modification no earlier than publication', () => {
    for (const record of [...getAllTools(), ...getAllComparisons()]) {
      expect(record.datePublished, record.slug).toMatch(DATE);
      expect(record.dateModified, record.slug).toMatch(DATE);
      expect(record.dateModified >= record.datePublished, record.slug).toBe(true);
    }
  });

  it('roll up to the index as the latest change', () => {
    const latest = listResourcePages()
      .map(page => page.dateModified)
      .sort()
      .at(-1);
    expect(resourcesIndexDateModified()).toBe(latest);
  });
});

describe('sitemap', () => {
  it('lists every resource page once with its own lastmod', () => {
    const entries = sitemapEntries();
    const paths = entries.map(entry => entry.path);
    expect(new Set(paths).size).toBe(paths.length);

    for (const page of listResourcePages()) {
      const entry = entries.find(candidate => candidate.path === page.path);
      expect(entry?.lastmod, page.path).toBe(page.dateModified);
    }
    expect(entries.find(entry => entry.path === '/resources')?.lastmod).toBe(
      resourcesIndexDateModified(),
    );
    expect(paths).toContain('/');
    expect(paths).toContain('/pricing');
  });

  it('renders well-formed XML with absolute canonical locations', () => {
    const xml = renderSitemap('https://corates.org');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    expect(doc.querySelector('parsererror')).toBeNull();

    const locs = Array.from(doc.querySelectorAll('url > loc'), node => node.textContent);
    expect(locs).toHaveLength(sitemapEntries().length);
    expect(locs).toContain('https://corates.org/');
    expect(locs).toContain('https://corates.org/resources/rob2');
    for (const loc of locs) {
      expect(loc?.endsWith('/') && loc !== 'https://corates.org/').toBe(false);
    }
    for (const lastmod of doc.querySelectorAll('url > lastmod')) {
      expect(lastmod.textContent).toMatch(DATE);
    }
  });
});
