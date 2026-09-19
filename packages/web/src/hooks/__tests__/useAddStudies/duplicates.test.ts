/**
 * Recognising the same paper twice. The fixtures are strings production actually produced:
 * titles PDF extraction returned for real uploads, and the published titles those papers carry.
 */

import { describe, it, expect } from 'vitest';
import { isWeakTitle, matchEntries, preferPublishedTitle } from '../../useAddStudies/matching';
import { findExistingMatch, describeMatch } from '../../useAddStudies/existing';
import { buildDeduplicatedStudies } from '../../useAddStudies/deduplication';

/** Titles extraction returned for unrelated papers in production. */
const EXTRACTED_JUNK = [
  'untitled',
  'Untitled',
  'RESEARCH Open Access',
  'RE S E AR C H RE P O R T',
  'Preview Summary',
  'Report',
  'Foreword',
  'Clinical Trial Protocol',
  'Hrev_master',
  'IR_220189 355..362',
  'feduc-2021-731657 1..9',
  'Microsoft Word - IJPCR^JVol15^JIssue4^JArticle216.docx',
  'OUTCOM~1 (My EndNote Library)',
  'International Journal of Academic Medicine and Pharmacy (www.academicmed.org)',
  'Asian J Sports Med. 2023 March; 14(1):e120485.',
];

/** Published titles of papers in production projects. */
const REAL_TITLES = [
  'Evaluation of a new job training program',
  'A Randomized Trial of Intra-articular Injection Therapy for Knee Osteoarthritis',
  'Effects of Platelet-Rich Plasma on Pain and Muscle Strength in Patients With Knee Osteoarthritis',
  'Biosimilar SB17 versus reference ustekinumab in moderate to severe plaque psoriasis after switching: phase 3 study',
  'The Effect of Mentoring on Undergraduate Mentors: A Systematic Review of the Literature',
];

describe('isWeakTitle', () => {
  it.each(EXTRACTED_JUNK)('rejects %s', title => {
    expect(isWeakTitle(title)).toBe(true);
  });

  it.each(REAL_TITLES)('accepts %s', title => {
    expect(isWeakTitle(title)).toBe(false);
  });

  it.each([null, undefined, '', '   '])('rejects %s', title => {
    expect(isWeakTitle(title)).toBe(true);
  });
});

describe('matchEntries', () => {
  const title = 'A Randomized Trial of Intra-articular Injection Therapy for Knee Osteoarthritis';

  it('matches on DOI whatever the titles say', () => {
    expect(
      matchEntries(
        { doi: 'https://doi.org/10.1001/JAMA.2022.0303', title: 'IR_220189 355..362' },
        { doi: '10.1001/jama.2022.0303', title },
      ),
    ).toBe('doi');
  });

  it('treats two different DOIs as different papers, even with the same title', () => {
    expect(matchEntries({ doi: '10.1234/a', title }, { doi: '10.1234/b', title })).toBeNull();
  });

  it('matches PDFs of the same size when neither has a usable title', () => {
    expect(
      matchEntries(
        { title: 'RE S E AR C H RE P O R T', fileSize: 1180849 },
        { title: 'RE S E AR C H RE P O R T', fileSize: 1180849 },
      ),
    ).toBe('file');
  });

  it('does not match unrelated papers that both extracted to boilerplate', () => {
    expect(
      matchEntries({ title: 'untitled', fileSize: 111 }, { title: 'untitled', fileSize: 222 }),
    ).toBeNull();
  });

  it('matches a title truncated where it wrapped against the published one', () => {
    expect(
      matchEntries(
        { title: 'Comparative efficacy and safety of biosimilar Bmab 1200 versus reference us' },
        {
          title:
            'Comparative efficacy and safety of biosimilar Bmab 1200 versus reference ustekinumab in moderate-to-severe plaque psoriasis',
        },
      ),
    ).toBe('title-substring');
  });

  it('matches an extracted title against a study named from a file name', () => {
    expect(
      matchEntries(
        { title: 'Relationship Between the Underlying Factors and the Treatment Results of PRP' },
        {
          title:
            'Mardani 2023- Relationship Between the Underlying Factors and the Treatment Results of PRP',
        },
      ),
    ).toBe('title-substring');
  });

  it('keeps sibling trials of the same drug apart', () => {
    expect(
      matchEntries(
        {
          title:
            'Efficacy and safety of the ustekinumab biosimilar, Bmab 1200, versus reference ustekinumab in moderate-to-severe plaque psoriasis',
        },
        {
          title:
            'Comparative efficacy and safety of biosimilar Bmab 1200 versus reference ustekinumab in moderate-to-severe plaque psoriasis',
        },
      ),
    ).toBeNull();
  });
});

describe('preferPublishedTitle', () => {
  const published =
    'Effects of Platelet-Rich Plasma on Pain and Muscle Strength in Patients With Knee Osteoarthritis';

  it('replaces a title the PDF could not give', () => {
    expect(preferPublishedTitle('untitled', published)).toBe(published);
  });

  it('completes a title cut off where it wrapped', () => {
    expect(
      preferPublishedTitle(
        'Effects of Platelet-Rich Plasma on Pain and Muscle Strength',
        published,
      ),
    ).toBe(published);
  });

  it('keeps the extracted title when the DOI belongs to another paper', () => {
    const extracted = 'A Randomized Trial of Intra-articular Injection Therapy for Knee Arthritis';
    expect(preferPublishedTitle(extracted, published)).toBe(extracted);
  });

  it('keeps the extracted title when the lookup returned nothing', () => {
    expect(preferPublishedTitle('untitled', undefined)).toBe('untitled');
  });
});

describe('findExistingMatch', () => {
  const existing = [
    {
      id: 'study-1',
      title: 'A Randomized Trial of Intra-articular Injection Therapy for Knee Osteoarthritis',
      doi: '10.1001/jama.2022.0303',
      fileSizes: [648180],
    },
  ];

  it('finds the study by DOI', () => {
    expect(
      findExistingMatch(
        { title: 'IR_220189 355..362', doi: '10.1001/jama.2022.0303', fileSize: 1 },
        existing,
      ),
    ).toMatchObject({ studyId: 'study-1', kind: 'doi' });
  });

  it('finds the study by file when the title is unusable', () => {
    expect(
      findExistingMatch({ title: 'untitled', doi: null, fileSize: 648180 }, existing),
    ).toMatchObject({ studyId: 'study-1', kind: 'file' });
  });

  it('returns null for a paper the project does not have', () => {
    expect(
      findExistingMatch(
        {
          title: 'Exercise therapy for chronic low back pain: a randomized trial',
          doi: null,
          fileSize: 42,
        },
        existing,
      ),
    ).toBeNull();
  });

  it('describes why a row was flagged', () => {
    expect(describeMatch({ studyId: 's', studyTitle: 't', kind: 'file' })).toMatch(/same file/i);
    expect(describeMatch({ studyId: 's', studyTitle: 't', kind: 'doi' })).toMatch(/same doi/i);
  });
});

describe('buildDeduplicatedStudies with the new matcher', () => {
  const pdf = (id: string, title: string, size: number, data: string) => ({
    id,
    file: { name: `${id}.pdf`, size },
    title,
    extracting: false,
    data,
    doi: null,
  });

  it('keeps one report staged per site when the same file is uploaded several times', () => {
    // Production has 14 studies built from 4 identical PDFs, one per site.
    const result = buildDeduplicatedStudies({
      uploadedPdfs: [
        pdf('anderson-ks', 'RE S E AR C H RE P O R T', 1180849, 'a'),
        pdf('anderson-ky', 'RE S E AR C H RE P O R T', 1180849, 'b'),
        pdf('anderson-la', 'RE S E AR C H RE P O R T', 1180849, 'c'),
      ] as never,
      selectedRefs: [],
      selectedLookups: [],
      driveFiles: [],
    });

    expect(result).toHaveLength(3);
  });

  it('keeps both files when two distinct PDFs merge into one study', () => {
    const result = buildDeduplicatedStudies({
      uploadedPdfs: [
        {
          ...pdf('preprint', 'Exercise therapy for chronic low back pain', 100, 'preprint-data'),
          doi: '10.1234/same',
        },
        {
          ...pdf('published', 'Exercise therapy for chronic low back pain', 200, 'published-data'),
          doi: '10.1234/same',
        },
      ] as never,
      selectedRefs: [],
      selectedLookups: [],
      driveFiles: [],
    });

    expect(result).toHaveLength(1);
    expect(result[0].pdfData).toBe('preprint-data');
    expect(result[0].extraPdfs).toHaveLength(1);
    expect(result[0].extraPdfs[0].data).toBe('published-data');
  });

  it('does not merge unrelated papers whose titles both came out as boilerplate', () => {
    const result = buildDeduplicatedStudies({
      uploadedPdfs: [
        pdf('wu-2018', 'untitled', 111, 'a'),
        pdf('martini-2024', 'untitled', 222, 'b'),
      ] as never,
      selectedRefs: [],
      selectedLookups: [],
      driveFiles: [],
    });

    expect(result).toHaveLength(2);
  });
});

describe('conflicting metadata between merged sources', () => {
  it('names the fields the sources disagree on', () => {
    const result = buildDeduplicatedStudies({
      uploadedPdfs: [
        {
          id: 'pdf-1',
          file: { name: 'trial.pdf', size: 100 },
          title: 'Exercise therapy for chronic low back pain: a randomized trial',
          extracting: false,
          data: 'pdf-data',
          doi: '10.1234/same',
          metadata: { firstAuthor: 'Smith', publicationYear: 2019, journal: 'Spine' },
        },
      ] as never,
      selectedRefs: [
        {
          _id: 'ref-1',
          title: 'Exercise therapy for chronic low back pain: a randomized trial',
          doi: '10.1234/same',
          firstAuthor: 'Smith',
          publicationYear: 2020,
          journal: 'The Lancet',
        },
      ] as never,
      selectedLookups: [],
      driveFiles: [],
    });

    expect(result).toHaveLength(1);
    expect(result[0].conflictingFields).toEqual(['year', 'journal']);
  });

  it('reports nothing for a study from a single source', () => {
    const result = buildDeduplicatedStudies({
      uploadedPdfs: [
        {
          id: 'pdf-1',
          file: { name: 'trial.pdf', size: 100 },
          title: 'Exercise therapy for chronic low back pain: a randomized trial',
          extracting: false,
          data: 'pdf-data',
          doi: null,
        },
      ] as never,
      selectedRefs: [],
      selectedLookups: [],
      driveFiles: [],
    });

    expect(result[0].conflictingFields).toEqual([]);
  });
});
