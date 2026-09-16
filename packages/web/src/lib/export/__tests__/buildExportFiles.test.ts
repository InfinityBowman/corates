import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import { DEFAULT_EXPORT_OPTIONS, type ExportOptions } from '../exportOptions';
import { filterStudiesForExport, pickStudies } from '../selectStudiesForExport';
import {
  buildExportFiles,
  planExportFilenames,
  planZipFilename,
  zipExportFiles,
  type ExportInput,
} from '../buildExportFiles';
import { OUTCOME_PAIN, largeProject, members, meta, reconciledCell, study } from './fixtures';

const DATE = '2026-09-15';
const twelveIds = Array.from({ length: 12 }, (_, i) => `s${String(i + 1).padStart(2, '0')}`);

function input(
  options: Partial<ExportOptions>,
  studyIds: string[] | null = twelveIds,
  project = largeProject(),
): ExportInput {
  const merged = { ...DEFAULT_EXPORT_OPTIONS, ...options };
  const studies = pickStudies(filterStudiesForExport(project, merged), studyIds);
  return { studies, members, meta, projectName: meta.name!, options: merged, date: DATE };
}

describe('planExportFilenames', () => {
  it('names one combined file after the project and date', () => {
    expect(planExportFilenames(input({ delivery: 'single', format: 'csv' }))).toEqual([
      'exercise-for-chronic-low-back-pain_rob2_2026-09-15.csv',
    ]);
  });

  it('names per-appraisal files by author, year, tool, outcome and reviewer', () => {
    const names = planExportFilenames(input({ delivery: 'zip', outcomeId: 'outcome-pain' }));
    expect(names).toHaveLength(6);
    expect(names[0]).toBe('author1-2021_rob2_pain-intensity_ravi-anand_2026-09-15.pdf');
    expect(planExportFilenames(input({ delivery: 'single', outcomeId: 'outcome-pain' }))[0]).toBe(
      'exercise-for-chronic-low-back-pain_pain-intensity_rob2_2026-09-15.pdf',
    );
  });

  it('gives a reconciled study one file per copy when consensus only is off', () => {
    const project = [
      study('dual', reconciledCell(OUTCOME_PAIN), { firstAuthor: 'Diaz', publicationYear: '2020' }),
    ];
    const names = planExportFilenames(
      input({ delivery: 'perAppraisal', consensusOnly: false }, null, project),
    );
    expect(names).toEqual([
      'diaz-2020_rob2_pain-intensity_ravi-anand_2026-09-15.pdf',
      'diaz-2020_rob2_pain-intensity_lena-ortiz_2026-09-15.pdf',
      'diaz-2020_rob2_pain-intensity_consensus_2026-09-15.pdf',
    ]);
    expect(planExportFilenames(input({ delivery: 'perAppraisal' }, null, project))).toEqual([
      'diaz-2020_rob2_pain-intensity_consensus_2026-09-15.pdf',
    ]);
  });
});

describe('buildExportFiles and zipExportFiles', () => {
  it('exports exactly 12 of 80 studies as 12 separate PDFs in one ZIP', async () => {
    const plan = input({ delivery: 'zip', format: 'pdf' });
    expect(plan.studies).toHaveLength(12);

    const progress: number[] = [];
    const files = await buildExportFiles(plan, { onProgress: p => progress.push(p.done) });
    expect(files).toHaveLength(12);
    expect(progress[0]).toBe(0);
    expect(progress.at(-1)).toBe(12);

    const zip = unzipSync(zipExportFiles(files));
    const entries = Object.keys(zip);
    expect(entries).toHaveLength(12);
    expect(entries[0]).toBe('author1-2021_rob2_pain-intensity_ravi-anand_2026-09-15.pdf');
    expect(strFromU8(zip[entries[0]].slice(0, 5))).toBe('%PDF-');
    expect(planZipFilename(plan)).toBe('exercise-for-chronic-low-back-pain_2026-09-15.zip');
  });

  it('builds one CSV holding every selected study when delivery is single', async () => {
    const files = await buildExportFiles(input({ delivery: 'single', format: 'csv' }));
    expect(files).toHaveLength(1);
    const lines = strFromU8(files[0].data).split('\n');
    expect(lines).toHaveLength(13);
    expect(lines[0]).toContain('Outcome');
  });

  it('stops between studies when the signal aborts', async () => {
    const controller = new AbortController();
    const plan = input({ delivery: 'perAppraisal', format: 'csv' });
    const run = buildExportFiles(plan, {
      signal: controller.signal,
      onProgress: p => {
        if (p.done === 3) controller.abort();
      },
    });
    await expect(run).rejects.toMatchObject({ name: 'AbortError' });
  });
});
