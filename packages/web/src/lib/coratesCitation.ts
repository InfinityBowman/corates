/**
 * Citations for CoRATES itself, shared by the /cite page and the in-app
 * "Cite CoRATES" popover. Author order matches CITATION.cff.
 */

import { APP_DOI, APP_FULL_NAME, APP_NAME, APP_PUBLISHER } from '@/config/app';

const AUTHORS = [
  { family: 'Maynard', given: 'Jacob A.' },
  { family: 'Maynard', given: 'Brandy R.' },
];

// Citations always point at production, whatever environment renders them.
const CORATES_URL = 'https://corates.org';

const TITLE = `${APP_NAME} (${APP_FULL_NAME})`;

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export interface CitationOptions {
  now?: Date;
  doi?: string | null;
}

export interface CoratesCitations {
  apa: string;
  ama: string;
  vancouver: string;
  bibtex: string;
  ris: string;
}

function initials(given: string): string[] {
  return given.split(/\s+/).map(name => name.charAt(0));
}

function isoDate(date: Date, separator: string): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return [date.getFullYear(), month, day].join(separator);
}

export function getCoratesCitations({
  now = new Date(),
  doi = APP_DOI,
}: CitationOptions = {}): CoratesCitations {
  const year = now.getFullYear();
  const link = doi ? `https://doi.org/${doi}` : CORATES_URL;
  const fullNames = AUTHORS.map(a => `${a.family}, ${a.given}`);

  const apaNames = AUTHORS.map(a => `${a.family}, ${initials(a.given).join('. ')}.`);
  const apaAuthors = `${apaNames.slice(0, -1).join(', ')}, & ${apaNames.at(-1)}`;
  const compactAuthors = AUTHORS.map(a => `${a.family} ${initials(a.given).join('')}`).join(', ');

  // AMA drops the access date when a DOI is given; NLM keeps [cited] either way.
  // Both styles write the date the same way regardless of the reader's locale.
  const accessed = now.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const amaTail = doi ? `doi:${doi}` : `Accessed ${accessed}. ${CORATES_URL}`;
  const cited = `${year} ${MONTHS_SHORT[now.getMonth()]} ${now.getDate()}`;

  const bibtex = [
    '@software{corates,',
    `  author = {${fullNames.join(' and ')}},`,
    `  title = {{${APP_NAME}} (${APP_FULL_NAME})},`,
    `  publisher = {${APP_PUBLISHER}},`,
    `  year = {${year}},`,
    `  url = {${CORATES_URL}},`,
    ...(doi ? [`  doi = {${doi}},`] : []),
    `  urldate = {${isoDate(now, '-')}}`,
    '}',
  ].join('\n');

  const ris = [
    'TY  - COMP',
    ...fullNames.map(name => `AU  - ${name}`),
    `TI  - ${TITLE}`,
    `PB  - ${APP_PUBLISHER}`,
    `PY  - ${year}`,
    `UR  - ${CORATES_URL}`,
    ...(doi ? [`DO  - ${doi}`] : []),
    `Y2  - ${isoDate(now, '/')}`,
    'ER  - ',
    '',
  ].join('\r\n');

  return {
    apa: `${apaAuthors} (${year}). ${TITLE} [Computer software]. ${APP_PUBLISHER}. ${link}`,
    ama: `${compactAuthors}. ${TITLE} [software]. ${APP_PUBLISHER}; ${year}. ${amaTail}`,
    vancouver: `${compactAuthors}. ${TITLE} [computer program]. ${APP_PUBLISHER}; ${year} [cited ${cited}]. Available from: ${link}`,
    bibtex,
    ris,
  };
}

/** Highwire Press tags, which Google Scholar and Zotero read from the page head. */
export function coratesCitationMeta({ now = new Date(), doi = APP_DOI }: CitationOptions = {}) {
  return [
    { name: 'citation_title', content: TITLE },
    ...AUTHORS.map(a => ({ name: 'citation_author', content: `${a.family}, ${a.given}` })),
    { name: 'citation_publication_date', content: String(now.getFullYear()) },
    { name: 'citation_publisher', content: APP_PUBLISHER },
    ...(doi ? [{ name: 'citation_doi', content: doi }] : []),
  ];
}
