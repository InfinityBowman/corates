import type { StudyInfo } from '@/stores/projectStore';

export interface FilenameContext {
  projectName: string;
  /** Checklist type key when the whole export is one tool, e.g. ROB2. */
  tool: string | null;
  outcome: string | null;
  date: string;
}

export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
      .replace(/-+$/, '') || ''
  );
}

export function isoDate(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

const toolSlug = (tool: string | null) => (tool ? tool.toLowerCase().replace(/_/g, '-') : '');

function join(parts: Array<string | null | undefined>, ext: string): string {
  const name = parts.filter(Boolean).join('_') || 'export';
  return `${name}.${ext}`;
}

export function combinedFilename(ctx: FilenameContext, ext: string): string {
  return join(
    [slugify(ctx.projectName), ctx.outcome && slugify(ctx.outcome), toolSlug(ctx.tool), ctx.date],
    ext,
  );
}

export interface AppraisalNameParts {
  /** Checklist type key, e.g. ROB2. */
  tool: string;
  outcome: string | null;
  /** Reviewer name, "consensus", or null for a local appraisal with no members. */
  who: string | null;
}

export function appraisalFilename(
  study: Pick<StudyInfo, 'name' | 'firstAuthor' | 'publicationYear'>,
  parts: AppraisalNameParts,
  ctx: FilenameContext,
  ext: string,
): string {
  const citation =
    study.firstAuthor ?
      [study.firstAuthor, study.publicationYear].filter(Boolean).join(' ')
    : study.name;
  return join(
    [
      slugify(citation) || 'study',
      toolSlug(parts.tool),
      parts.outcome && slugify(parts.outcome),
      parts.who && slugify(parts.who),
      ctx.date,
    ],
    ext,
  );
}

export function zipFilename(ctx: FilenameContext): string {
  return join([slugify(ctx.projectName), ctx.date], 'zip');
}

/** Two studies by the same author and year must not overwrite each other inside a ZIP. */
export function uniqueFilenames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map(name => {
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);
    if (count === 0) return name;
    const dot = name.lastIndexOf('.');
    return `${name.slice(0, dot)}-${count + 1}${name.slice(dot)}`;
  });
}
