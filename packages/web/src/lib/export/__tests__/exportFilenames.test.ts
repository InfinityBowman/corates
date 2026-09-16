import { describe, expect, it } from 'vitest';
import { appraisalFilename, combinedFilename, slugify, uniqueFilenames } from '../exportFilenames';

const ctx = {
  projectName: 'Exercise for chronic low back pain',
  tool: 'ROB2',
  outcome: 'Pain intensity',
  date: '2026-09-15',
};

describe('slugify', () => {
  it('lowercases, strips punctuation, and never leaves a leading or trailing dash', () => {
    expect(slugify('Alvarez (2021): Graded activity!')).toBe('alvarez-2021-graded-activity');
    expect(slugify('  ')).toBe('');
  });
});

describe('combinedFilename', () => {
  it('carries project, outcome, tool, and date in a fixed order', () => {
    expect(combinedFilename(ctx, 'pdf')).toBe(
      'exercise-for-chronic-low-back-pain_pain-intensity_rob2_2026-09-15.pdf',
    );
  });

  it('leaves out the parts the selection does not pin down', () => {
    expect(combinedFilename({ ...ctx, tool: null, outcome: null }, 'csv')).toBe(
      'exercise-for-chronic-low-back-pain_2026-09-15.csv',
    );
    expect(combinedFilename({ ...ctx, tool: 'ROBINS_I' }, 'csv')).toContain('_robins-i_');
  });
});

describe('appraisalFilename', () => {
  const parts = { tool: 'ROB2', outcome: 'Pain intensity', who: 'Lena Ortiz' };

  it('carries citation, tool, outcome, reviewer and date in a fixed order', () => {
    const study = {
      name: 'Graded activity vs usual care',
      firstAuthor: 'Alvarez',
      publicationYear: '2021',
    };
    expect(appraisalFilename(study, parts, ctx, 'pdf')).toBe(
      'alvarez-2021_rob2_pain-intensity_lena-ortiz_2026-09-15.pdf',
    );
    expect(appraisalFilename(study, { ...parts, who: 'consensus' }, ctx, 'pdf')).toContain(
      '_consensus_',
    );
  });

  it('falls back to the name, then to a placeholder, and drops the slots it has no value for', () => {
    const named = { name: 'Graded activity', firstAuthor: null, publicationYear: null };
    expect(
      appraisalFilename(named, { tool: 'AMSTAR2', outcome: null, who: null }, ctx, 'pdf'),
    ).toBe('graded-activity_amstar2_2026-09-15.pdf');
    const blank = { name: '', firstAuthor: null, publicationYear: null };
    expect(appraisalFilename(blank, { ...parts, outcome: null, who: null }, ctx, 'pdf')).toBe(
      'study_rob2_2026-09-15.pdf',
    );
  });
});

describe('uniqueFilenames', () => {
  it('numbers collisions from the second occurrence on', () => {
    expect(uniqueFilenames(['a.pdf', 'b.pdf', 'a.pdf', 'a.pdf'])).toEqual([
      'a.pdf',
      'b.pdf',
      'a-2.pdf',
      'a-3.pdf',
    ]);
  });
});
