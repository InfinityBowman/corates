/**
 * Bug-hunt probes for referenceParser.ts
 *
 * Each test asserts the evident intended behavior. Failures are candidate bugs.
 */

import { describe, it, expect } from 'vitest';
import { parseRIS, parseBibTeX } from '../referenceParser.js';

describe('parseRIS - state reset between records', () => {
  it('does not leak the last field of one record into the next record', () => {
    // Ref 1 ends with an abstract, ref 2 has no abstract of its own.
    const ris = `TY  - JOUR
TI  - First Study
AU  - Alpha, Ann
AB  - Abstract belonging to the first study only.
ER  - 
TY  - JOUR
TI  - Second Study
AU  - Beta, Bob
ER  - `;

    const refs = parseRIS(ris);
    expect(refs).toHaveLength(2);
    expect(refs[0].abstract).toBe('Abstract belonging to the first study only.');
    // The second study never declared an AB tag, so its abstract must be null.
    expect(refs[1].abstract).toBeNull();
  });

  it('does not duplicate list fields (authors) into the next record', () => {
    // Ref 1 ends with an AU tag; ref 2 must not inherit it.
    const ris = `TY  - JOUR
TI  - First Study
AU  - Alpha, Ann
ER  - 
TY  - JOUR
TI  - Second Study
AU  - Beta, Bob
ER  - `;

    const refs = parseRIS(ris);
    expect(refs).toHaveLength(2);
    expect(refs[1].authors).toBe('Beta, Bob');
    expect(refs[1].firstAuthor).toBe('Beta');
  });
});

describe('parseBibTeX - standard page range syntax', () => {
  it('parses the standard double-hyphen page range used by Zotero/BibTeX exports', () => {
    const bibtex = `@article{smith2020,
  title = {A Study},
  author = {Smith, John},
  year = {2020},
  pages = {100--105}
}`;

    const refs = parseBibTeX(bibtex);
    expect(refs).toHaveLength(1);
    expect(refs[0].pages).toBe('100-105');
  });

  it('still parses single-hyphen page ranges', () => {
    const bibtex = `@article{smith2020,
  title = {A Study},
  author = {Smith, John},
  year = {2020},
  pages = {100-105}
}`;

    const refs = parseBibTeX(bibtex);
    expect(refs[0].pages).toBe('100-105');
  });
});

describe('parseBibTeX - brace-protected words in field values', () => {
  it('keeps the full title when it contains case-protecting braces', () => {
    // Zotero commonly exports titles like {The {COVID-19} Pandemic}
    const bibtex = `@article{key1,
  title = {The {Big} Elephant},
  author = {Smith, John},
  year = {2021}
}`;

    const refs = parseBibTeX(bibtex);
    expect(refs).toHaveLength(1);
    // cleanBibTeXValue strips braces, so the intended output is the full text
    expect(refs[0].title).toBe('The Big Elephant');
  });
});
