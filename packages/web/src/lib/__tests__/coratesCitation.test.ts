import { describe, expect, it } from 'vitest';
import { coratesCitationMeta, getCoratesCitations } from '@/lib/coratesCitation';

// Late evening local time, which is already the next day in UTC for US readers.
const now = new Date(2026, 8, 5, 23, 30);
const doi = '10.5281/zenodo.1234567';

describe('getCoratesCitations without a DOI', () => {
  const citations = getCoratesCitations({ now, doi: null });

  it('formats APA with initials and the site URL', () => {
    expect(citations.apa).toBe(
      'Maynard, J. A., & Maynard, B. R. (2026). CoRATES (Collaborative Research Appraisal Tool for Evidence Synthesis) [Computer software]. Syntch LLC. https://corates.org',
    );
  });

  it('gives AMA and Vancouver the local access date', () => {
    expect(citations.ama).toBe(
      'Maynard JA, Maynard BR. CoRATES (Collaborative Research Appraisal Tool for Evidence Synthesis) [software]. Syntch LLC; 2026. Accessed September 5, 2026. https://corates.org',
    );
    expect(citations.vancouver).toBe(
      'Maynard JA, Maynard BR. CoRATES (Collaborative Research Appraisal Tool for Evidence Synthesis) [computer program]. Syntch LLC; 2026 [cited 2026 Sep 5]. Available from: https://corates.org',
    );
  });

  it('leaves the DOI out of BibTeX and RIS', () => {
    expect(citations.bibtex).toContain('author = {Maynard, Jacob A. and Maynard, Brandy R.}');
    expect(citations.bibtex).toContain('urldate = {2026-09-05}');
    expect(citations.bibtex).not.toContain('doi');
    expect(citations.ris).not.toContain('DO  -');
  });

  it('writes RIS with CRLF line endings, one AU per author, and an end record', () => {
    const lines = citations.ris.split('\r\n');
    expect(lines[0]).toBe('TY  - COMP');
    expect(lines.filter(line => line.startsWith('AU  - '))).toEqual([
      'AU  - Maynard, Jacob A.',
      'AU  - Maynard, Brandy R.',
    ]);
    expect(lines).toContain('Y2  - 2026/09/05');
    expect(lines.at(-2)).toBe('ER  - ');
  });
});

describe('getCoratesCitations with a DOI', () => {
  const citations = getCoratesCitations({ now, doi });

  it('links APA and Vancouver to the DOI resolver', () => {
    expect(citations.apa.endsWith(`https://doi.org/${doi}`)).toBe(true);
    expect(citations.vancouver.endsWith(`Available from: https://doi.org/${doi}`)).toBe(true);
  });

  it('replaces the AMA access date and URL with the DOI', () => {
    expect(citations.ama.endsWith(`Syntch LLC; 2026. doi:${doi}`)).toBe(true);
    expect(citations.ama).not.toContain('Accessed');
  });

  it('adds the DOI to BibTeX and RIS', () => {
    expect(citations.bibtex).toContain(`doi = {${doi}},`);
    expect(citations.ris.split('\r\n')).toContain(`DO  - ${doi}`);
  });
});

describe('coratesCitationMeta', () => {
  it('emits one citation_author per author and citation_doi only when a DOI exists', () => {
    const without = coratesCitationMeta({ now, doi: null });
    expect(without.filter(tag => tag.name === 'citation_author')).toHaveLength(2);
    expect(without.find(tag => tag.name === 'citation_doi')).toBeUndefined();

    const withDoi = coratesCitationMeta({ now, doi });
    expect(withDoi).toContainEqual({ name: 'citation_doi', content: doi });
    expect(withDoi).toContainEqual({ name: 'citation_publication_date', content: '2026' });
  });
});
