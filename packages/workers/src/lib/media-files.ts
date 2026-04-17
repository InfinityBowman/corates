import { mediaFiles } from '@corates/db/schema';
import { and, eq } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';

export async function generateUniqueFileName(
  fileName: string,
  projectId: string,
  studyId: string,
  db: DrizzleD1Database<Record<string, unknown>>,
): Promise<string> {
  const existing = await db
    .select({ id: mediaFiles.id })
    .from(mediaFiles)
    .where(
      and(
        eq(mediaFiles.projectId, projectId),
        eq(mediaFiles.studyId, studyId),
        eq(mediaFiles.filename, fileName),
      ),
    )
    .get();

  if (!existing) {
    return fileName;
  }

  const lastDot = fileName.lastIndexOf('.');
  const nameWithoutExt = lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
  const ext = lastDot > 0 ? fileName.slice(lastDot) : '';

  let counter = 1;
  let uniqueFileName = fileName;
  let found = true;

  while (found && counter < 1000) {
    uniqueFileName = `${nameWithoutExt} (${counter})${ext}`;
    const duplicate = await db
      .select({ id: mediaFiles.id })
      .from(mediaFiles)
      .where(
        and(
          eq(mediaFiles.projectId, projectId),
          eq(mediaFiles.studyId, studyId),
          eq(mediaFiles.filename, uniqueFileName),
        ),
      )
      .get();

    if (!duplicate) {
      found = false;
    } else {
      counter++;
    }
  }

  if (found) {
    const timestamp = Date.now();
    uniqueFileName = `${nameWithoutExt}_${timestamp}${ext}`;
  }

  return uniqueFileName;
}
