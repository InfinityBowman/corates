import type { StudyInfo } from '@/stores/projectStore';

/** "Author (Year) - Journal", preferring the primary PDF's metadata over the study's. */
export function studyCitation(study: StudyInfo): string {
  const pdfs = study.pdfs || [];
  const primaryPdf = pdfs.find(p => p.tag === 'primary') || pdfs[0];
  const parts: string[] = [];
  const author = primaryPdf?.firstAuthor || study.firstAuthor;
  const year = primaryPdf?.publicationYear || study.publicationYear;
  const journal = primaryPdf?.journal || study.journal;
  if (author) parts.push(author);
  if (year) parts.push(`(${year})`);
  if (journal) parts.push(`- ${journal}`);
  return parts.join(' ');
}
