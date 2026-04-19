import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { mediaFiles } from '@corates/db/schema';
import { and, eq } from 'drizzle-orm';
import {
  createDomainError,
  FILE_ERRORS,
  VALIDATION_ERRORS,
  SYSTEM_ERRORS,
  isValidPdfFilename,
} from '@corates/shared';
import type { OrgId, ProjectId, StudyId } from '@corates/shared/ids';
import { requireOrgMembership } from '@/server/guards/requireOrgMembership';
import { requireProjectAccess } from '@/server/guards/requireProjectAccess';
import { requireOrgWriteAccess } from '@/server/guards/requireOrgWriteAccess';

type HandlerArgs = {
  request: Request;
  params: { orgId: OrgId; projectId: ProjectId; studyId: StudyId; fileName: string };
};

function validateFileName(raw: string): { fileName: string; error?: Response } {
  const fileName = decodeURIComponent(raw);

  if (!fileName) {
    return {
      fileName,
      error: Response.json(
        createDomainError(
          VALIDATION_ERRORS.FIELD_REQUIRED,
          { field: 'fileName' },
          'Missing file name',
        ),
        { status: 400 },
      ),
    };
  }

  if (!isValidPdfFilename(fileName)) {
    return {
      fileName,
      error: Response.json(
        createDomainError(
          VALIDATION_ERRORS.FIELD_INVALID_FORMAT,
          { field: 'fileName', value: fileName },
          'Invalid file name',
        ),
        { status: 400 },
      ),
    };
  }

  return { fileName };
}

export const handleGet = async ({ request, params }: HandlerArgs) => {
  const orgMembership = await requireOrgMembership(request, env, params.orgId);
  if (!orgMembership.ok) return orgMembership.response;

  const access = await requireProjectAccess(request, env, params.orgId, params.projectId);
  if (!access.ok) return access.response;

  const { fileName, error: nameError } = validateFileName(params.fileName);
  if (nameError) return nameError;

  const key = `projects/${params.projectId}/studies/${params.studyId}/${fileName}`;

  try {
    const object = await env.PDF_BUCKET.get(key);

    if (!object) {
      return Response.json(createDomainError(FILE_ERRORS.NOT_FOUND, { fileName, key }), {
        status: 404,
      });
    }

    return new Response(object.body, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(
          fileName,
        )}`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (err) {
    const error = err as Error;
    console.error('PDF download error:', error);
    return Response.json(
      createDomainError(
        SYSTEM_ERRORS.INTERNAL_ERROR,
        { operation: 'download_pdf', originalError: error.message },
        error.message,
      ),
      { status: 500 },
    );
  }
};

export const handleDelete = async ({ request, params }: HandlerArgs) => {
  const orgMembership = await requireOrgMembership(request, env, params.orgId);
  if (!orgMembership.ok) return orgMembership.response;

  const writeAccess = await requireOrgWriteAccess(request.method, env, params.orgId);
  if (!writeAccess.ok) return writeAccess.response;

  const access = await requireProjectAccess(request, env, params.orgId, params.projectId);
  if (!access.ok) return access.response;

  const { fileName, error: nameError } = validateFileName(params.fileName);
  if (nameError) return nameError;

  const key = `projects/${params.projectId}/studies/${params.studyId}/${fileName}`;

  try {
    const db = createDb(env.DB);

    const existingRecord = await db
      .select({ id: mediaFiles.id })
      .from(mediaFiles)
      .where(
        and(
          eq(mediaFiles.projectId, params.projectId),
          eq(mediaFiles.studyId, params.studyId),
          eq(mediaFiles.filename, fileName),
        ),
      )
      .get();

    if (!existingRecord) {
      try {
        await env.PDF_BUCKET.delete(key);
      } catch (r2Error) {
        console.warn('PDF not found in database, R2 delete also failed:', r2Error);
      }
      return Response.json({ success: true }, { status: 200 });
    }

    await db
      .delete(mediaFiles)
      .where(
        and(
          eq(mediaFiles.projectId, params.projectId),
          eq(mediaFiles.studyId, params.studyId),
          eq(mediaFiles.filename, fileName),
        ),
      );

    try {
      await env.PDF_BUCKET.delete(key);
    } catch (r2Error) {
      console.error('Failed to delete PDF from R2 after database delete:', r2Error);
    }

    return Response.json({ success: true }, { status: 200 });
  } catch (err) {
    const error = err as Error;
    console.error('PDF delete error:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'delete_pdf',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute(
  '/api/orgs/$orgId/projects/$projectId/studies/$studyId/pdfs/$fileName',
)({
  server: {
    handlers: {
      GET: handleGet,
      DELETE: handleDelete,
    },
  },
});
