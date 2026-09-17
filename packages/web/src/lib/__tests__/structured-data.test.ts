import { describe, expect, it } from 'vitest';
import {
  articlePageGraph,
  collectionPageGraph,
  ORGANIZATION_ID,
  WEBSITE_ID,
} from '@/lib/structured-data';

type Node = Record<string, any>;

function parseGraph(json: string): Node[] {
  const parsed = JSON.parse(json);
  expect(parsed['@context']).toBe('https://schema.org');
  return parsed['@graph'];
}

const page = {
  url: 'https://corates.org/resources/rob2',
  name: 'RoB 2',
  description: 'How RoB 2 works.',
  breadcrumbs: [
    { name: 'Home', url: 'https://corates.org' },
    { name: 'Resources', url: 'https://corates.org/resources' },
    { name: 'RoB 2', url: 'https://corates.org/resources/rob2' },
  ],
  datePublished: '2026-03-07',
  dateModified: '2026-09-16',
};

describe('articlePageGraph', () => {
  it('links the article, page and breadcrumb to each other and to the root entities', () => {
    const [article, webPage, breadcrumb] = parseGraph(
      articlePageGraph({ ...page, about: [{ name: 'RoB 2', alternateName: 'Risk of Bias 2' }] }),
    );

    expect(article['@type']).toBe('TechArticle');
    expect(article.mainEntityOfPage['@id']).toBe(webPage['@id']);
    expect(article.isPartOf['@id']).toBe(WEBSITE_ID);
    expect(article.author['@id']).toBe(ORGANIZATION_ID);
    expect(article.publisher['@id']).toBe(ORGANIZATION_ID);
    expect(article.about).toEqual([
      { '@type': 'Thing', name: 'RoB 2', alternateName: 'Risk of Bias 2' },
    ]);
    expect(article.datePublished).toBe('2026-03-07');
    expect(article.dateModified).toBe('2026-09-16');

    expect(webPage['@type']).toBe('WebPage');
    expect(webPage['@id']).toBe(page.url);
    expect(webPage.isPartOf['@id']).toBe(WEBSITE_ID);
    expect(webPage.breadcrumb['@id']).toBe(breadcrumb['@id']);
    expect(webPage.mainEntity).toBeUndefined();

    expect(breadcrumb['@type']).toBe('BreadcrumbList');
    expect(breadcrumb.itemListElement.map((item: Node) => item.position)).toEqual([1, 2, 3]);
    expect(breadcrumb.itemListElement[2].item).toBe(page.url);
  });

  it('types the page as an FAQPage when it carries questions', () => {
    const faq = [{ question: 'Is it free?', answer: 'Yes.' }];
    const [, webPage] = parseGraph(articlePageGraph({ ...page, faq }));

    expect(webPage['@type']).toEqual(['WebPage', 'FAQPage']);
    expect(webPage.mainEntity).toEqual([
      {
        '@type': 'Question',
        name: 'Is it free?',
        acceptedAnswer: { '@type': 'Answer', text: 'Yes.' },
      },
    ]);
  });

  it('treats an empty faq as no faq', () => {
    const [, webPage] = parseGraph(articlePageGraph({ ...page, faq: [] }));
    expect(webPage['@type']).toBe('WebPage');
  });

  it('escapes angle brackets so copy cannot close the script block', () => {
    const json = articlePageGraph({ ...page, description: 'a </script> b' });
    expect(json).not.toContain('</script>');
    const [article] = parseGraph(json);
    expect(article.description).toBe('a </script> b');
  });
});

describe('collectionPageGraph', () => {
  it('lists the pages in order with a breadcrumb', () => {
    const [collection, breadcrumb] = parseGraph(
      collectionPageGraph({
        ...page,
        url: 'https://corates.org/resources',
        breadcrumbs: page.breadcrumbs.slice(0, 2),
        items: [
          { name: 'RoB 2', url: 'https://corates.org/resources/rob2' },
          { name: 'AMSTAR 2', url: 'https://corates.org/resources/amstar2' },
        ],
      }),
    );

    expect(collection['@type']).toBe('CollectionPage');
    expect(collection.mainEntity['@type']).toBe('ItemList');
    expect(collection.mainEntity.itemListElement).toEqual([
      {
        '@type': 'ListItem',
        position: 1,
        name: 'RoB 2',
        url: 'https://corates.org/resources/rob2',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'AMSTAR 2',
        url: 'https://corates.org/resources/amstar2',
      },
    ]);
    expect(collection.breadcrumb['@id']).toBe(breadcrumb['@id']);
    expect(breadcrumb.itemListElement).toHaveLength(2);
  });
});
