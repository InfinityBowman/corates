/**
 * JSON-LD builders shared by the root layout and the /resources pages.
 *
 * The root graph declares the Organization, WebSite and WebApplication once,
 * each with a stable id. Page graphs reference those ids instead of restating
 * the entities, so a crawler reads one connected graph per page rather than
 * several unrelated documents. Only assert what is verifiable: no ratings, no
 * invented authors beyond the Organization, no backdated publication dates.
 */

import type { FaqEntry } from '@/lib/tool-content';

export const SITE_URL = 'https://corates.org';
export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const WEBAPP_ID = `${SITE_URL}/#webapp`;

const LANGUAGE = 'en-US';

export interface Breadcrumb {
  name: string;
  url: string;
}

/** Dates are calendar days (YYYY-MM-DD) maintained alongside the page content */
export interface PageDates {
  datePublished: string;
  dateModified: string;
}

interface PageNodeInput extends PageDates {
  url: string;
  name: string;
  description: string;
  breadcrumbs: Breadcrumb[];
}

export interface ArticlePageInput extends PageNodeInput {
  /** The subjects the article covers, typically the appraisal tools it describes */
  about?: { name: string; alternateName?: string }[];
  faq?: FaqEntry[];
}

export interface CollectionPageInput extends PageNodeInput {
  items: { name: string; url: string }[];
}

type JsonLdNode = Record<string, unknown>;

/** A closing script tag inside page copy would end the JSON-LD block early */
export function serializeJsonLd(graph: JsonLdNode[]): string {
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(
    /</g,
    '\\u003c',
  );
}

function breadcrumbId(url: string) {
  return `${url}#breadcrumb`;
}

function breadcrumbNode(url: string, breadcrumbs: Breadcrumb[]): JsonLdNode {
  return {
    '@type': 'BreadcrumbList',
    '@id': breadcrumbId(url),
    itemListElement: breadcrumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  };
}

function pageNode(page: PageNodeInput, type: string | string[]): JsonLdNode {
  return {
    '@type': type,
    '@id': page.url,
    url: page.url,
    name: page.name,
    description: page.description,
    inLanguage: LANGUAGE,
    isPartOf: { '@id': WEBSITE_ID },
    breadcrumb: { '@id': breadcrumbId(page.url) },
    datePublished: page.datePublished,
    dateModified: page.dateModified,
  };
}

/**
 * A reference article page: a TechArticle whose main entity of page is the
 * WebPage node, which in turn carries the breadcrumb and, when the page has
 * one, the FAQ. FAQPage is a WebPage subtype, so the page node takes both
 * types rather than a separate FAQPage node claiming to be another page.
 */
export function articlePageGraph(page: ArticlePageInput): string {
  const hasFaq = page.faq !== undefined && page.faq.length > 0;
  const webPage = pageNode(page, hasFaq ? ['WebPage', 'FAQPage'] : 'WebPage');
  if (hasFaq) {
    webPage.mainEntity = page.faq!.map(entry => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: { '@type': 'Answer', text: entry.answer },
    }));
  }

  const article: JsonLdNode = {
    '@type': 'TechArticle',
    '@id': `${page.url}#article`,
    headline: page.name,
    description: page.description,
    inLanguage: LANGUAGE,
    mainEntityOfPage: { '@id': page.url },
    isPartOf: { '@id': WEBSITE_ID },
    author: { '@id': ORGANIZATION_ID },
    publisher: { '@id': ORGANIZATION_ID },
    datePublished: page.datePublished,
    dateModified: page.dateModified,
  };
  if (page.about && page.about.length > 0) {
    article.about = page.about.map(subject => ({ '@type': 'Thing', ...subject }));
  }

  return serializeJsonLd([article, webPage, breadcrumbNode(page.url, page.breadcrumbs)]);
}

/** An index page whose content is the list of pages it links to */
export function collectionPageGraph(page: CollectionPageInput): string {
  const collection = pageNode(page, 'CollectionPage');
  collection.mainEntity = {
    '@type': 'ItemList',
    itemListElement: page.items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      url: item.url,
    })),
  };
  return serializeJsonLd([collection, breadcrumbNode(page.url, page.breadcrumbs)]);
}
