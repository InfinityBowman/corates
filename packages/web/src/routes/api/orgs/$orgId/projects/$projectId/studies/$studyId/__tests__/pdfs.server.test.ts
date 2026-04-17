import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { and, eq } from 'drizzle-orm';
import { createDb } from '@corates/db/client';
import { mediaFiles } from '@corates/db/schema';
import { resetTestDatabase, seedMediaFile } from '@/__tests__/server/helpers';
import { buildProject, buildUser, buildOrgMember, resetCounter } from '@/__tests__/server/factories';
import { handleGet as listHandler, handlePost as uploadHandler } from '../pdfs';
import {
  handleGet as downloadHandler,
  handleDelete as deleteHandler,
} from '../pdfs/$fileName';
import { PDF_LIMITS } from '@corates/shared';

let currentUser: { id: string; email: string } = { id: 'user-1', email: 'user1@example.com' };

vi.mock('@corates/workers/auth', () => ({
  getSession: async () => ({
    user: { id: currentUser.id, email: currentUser.email, name: 'Test User' },
    session: { id: 'test-session', userId: currentUser.id },
  }),
}));

vi.mock('@corates/workers/billing-resolver', () => ({
  resolveOrgAccess: vi.fn(async () => ({
    accessMode: 'write',
    source: 'free',
    quotas: { 'projects.max': 10, 'collaborators.org.max': -1 },
    entitlements: { 'project.create': true },
  })),
}));

async function clearR2(prefix: string) {
  const listed = await env.PDF_BUCKET.list({ prefix });
  for (const obj of listed.objects) {
    await env.PDF_BUCKET.delete(obj.key);
  }
}

beforeEach(async () => {
  await resetTestDatabase();
  resetCounter();
  vi.clearAllMocks();
  currentUser = { id: 'user-1', email: 'user1@example.com' };
  await clearR2('projects/');
});

function req(path: string, method: string, init: RequestInit = {}): Request {
  return new Request(`http://localhost${path}`, { method, ...init });
}

const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);

describe('GET /api/orgs/:orgId/projects/:projectId/studies/:studyId/pdfs', () => {
  it('lists PDFs for a study', async () => {
    const { project, org, owner } = await buildProject();
    currentUser = { id: owner.id, email: owner.email };

    await seedMediaFile({
      id: 'media-1',
      filename: 'document.pdf',
      originalName: 'document.pdf',
      fileType: 'application/pdf',
      fileSize: 1024,
      uploadedBy: owner.id,
      bucketKey: `projects/${project.id}/studies/study-1/document.pdf`,
      orgId: org.id,
      projectId: project.id,
      studyId: 'study-1',
      createdAt: Math.floor(Date.now() / 1000),
    });

    const res = await listHandler({
      request: req(
        `/api/orgs/${org.id}/projects/${project.id}/studies/study-1/pdfs`,
        'GET',
      ),
      params: { orgId: org.id, projectId: project.id, studyId: 'study-1' },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      pdfs: Array<{ id: string; fileName: string; uploadedBy: { id: string } | null }>;
    };
    expect(body.pdfs).toHaveLength(1);
    expect(body.pdfs[0].fileName).toBe('document.pdf');
    expect(body.pdfs[0].id).toBe('media-1');
    expect(body.pdfs[0].uploadedBy?.id).toBe(owner.id);
  });

  it('requires project membership', async () => {
    const { project, org } = await buildProject();
    const nonMember = await buildUser({ email: 'nonmember@example.com' });
    await buildOrgMember({ orgId: org.id, user: nonMember, role: 'member' });
    currentUser = { id: nonMember.id, email: nonMember.email };

    const res = await listHandler({
      request: req(
        `/api/orgs/${org.id}/projects/${project.id}/studies/study-1/pdfs`,
        'GET',
      ),
      params: { orgId: org.id, projectId: project.id, studyId: 'study-1' },
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('PROJECT_ACCESS_DENIED');
  });
});

describe('POST /api/orgs/:orgId/projects/:projectId/studies/:studyId/pdfs', () => {
  it('uploads PDF successfully', async () => {
    const { project, org, owner } = await buildProject();
    currentUser = { id: owner.id, email: owner.email };

    const file = new File([PDF_MAGIC], 'document.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', file);

    const res = await uploadHandler({
      request: req(
        `/api/orgs/${org.id}/projects/${project.id}/studies/study-1/pdfs`,
        'POST',
        { body: formData },
      ),
      params: { orgId: org.id, projectId: project.id, studyId: 'study-1' },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; id: string; fileName: string; key: string };
    expect(body.success).toBe(true);
    expect(body.fileName).toBe('document.pdf');
    expect(body.key).toBe(`projects/${project.id}/studies/study-1/document.pdf`);

    const db = createDb(env.DB);
    const mediaFile = await db
      .select()
      .from(mediaFiles)
      .where(
        and(
          eq(mediaFiles.projectId, project.id),
          eq(mediaFiles.studyId, 'study-1'),
          eq(mediaFiles.filename, 'document.pdf'),
        ),
      )
      .get();
    expect(mediaFile).toBeDefined();
    expect(mediaFile!.id).toBe(body.id);
    expect(mediaFile!.orgId).toBe(org.id);

    const stored = await env.PDF_BUCKET.get(body.key);
    expect(stored).not.toBeNull();
  });

  it('rejects files that are too large via Content-Length', async () => {
    const { project, org, owner } = await buildProject();
    currentUser = { id: owner.id, email: owner.email };

    const formData = new FormData();
    formData.append('file', new File([PDF_MAGIC], 'small.pdf', { type: 'application/pdf' }));

    const res = await uploadHandler({
      request: req(
        `/api/orgs/${org.id}/projects/${project.id}/studies/study-1/pdfs`,
        'POST',
        {
          body: formData,
          headers: { 'Content-Length': String(PDF_LIMITS.MAX_SIZE + 1) },
        },
      ),
      params: { orgId: org.id, projectId: project.id, studyId: 'study-1' },
    });

    expect(res.status).toBe(413);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('FILE_TOO_LARGE');
  });

  it('rejects non-PDF files', async () => {
    const { project, org, owner } = await buildProject();
    currentUser = { id: owner.id, email: owner.email };

    const file = new File(['not a pdf'], 'document.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', file);

    const res = await uploadHandler({
      request: req(
        `/api/orgs/${org.id}/projects/${project.id}/studies/study-1/pdfs`,
        'POST',
        { body: formData },
      ),
      params: { orgId: org.id, projectId: project.id, studyId: 'study-1' },
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('FILE_INVALID_TYPE');
  });

  it('auto-renames duplicate file names', async () => {
    const { project, org, owner } = await buildProject();
    currentUser = { id: owner.id, email: owner.email };

    await seedMediaFile({
      id: 'media-1',
      filename: 'document.pdf',
      originalName: 'document.pdf',
      fileType: 'application/pdf',
      fileSize: 1024,
      uploadedBy: owner.id,
      bucketKey: `projects/${project.id}/studies/study-1/document.pdf`,
      orgId: org.id,
      projectId: project.id,
      studyId: 'study-1',
      createdAt: Math.floor(Date.now() / 1000),
    });

    const file = new File([PDF_MAGIC], 'document.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', file);

    const res = await uploadHandler({
      request: req(
        `/api/orgs/${org.id}/projects/${project.id}/studies/study-1/pdfs`,
        'POST',
        { body: formData },
      ),
      params: { orgId: org.id, projectId: project.id, studyId: 'study-1' },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { fileName: string; originalFileName: string; key: string };
    expect(body.fileName).toBe('document (1).pdf');
    expect(body.originalFileName).toBe('document.pdf');
    expect(body.key).toBe(`projects/${project.id}/studies/study-1/document (1).pdf`);
  });

  it('accepts raw PDF upload with X-File-Name header', async () => {
    const { project, org, owner } = await buildProject();
    currentUser = { id: owner.id, email: owner.email };

    const res = await uploadHandler({
      request: req(
        `/api/orgs/${org.id}/projects/${project.id}/studies/study-1/pdfs`,
        'POST',
        {
          body: PDF_MAGIC,
          headers: {
            'Content-Type': 'application/pdf',
            'X-File-Name': 'raw-document.pdf',
          },
        },
      ),
      params: { orgId: org.id, projectId: project.id, studyId: 'study-1' },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; fileName: string };
    expect(body.success).toBe(true);
    expect(body.fileName).toBe('raw-document.pdf');
  });
});

describe('GET /api/orgs/:orgId/projects/:projectId/studies/:studyId/pdfs/:fileName', () => {
  it('downloads PDF successfully', async () => {
    const { project, org, owner } = await buildProject();
    currentUser = { id: owner.id, email: owner.email };

    const key = `projects/${project.id}/studies/study-1/document.pdf`;
    await env.PDF_BUCKET.put(key, PDF_MAGIC, {
      httpMetadata: { contentType: 'application/pdf' },
    });

    const res = await downloadHandler({
      request: req(
        `/api/orgs/${org.id}/projects/${project.id}/studies/study-1/pdfs/document.pdf`,
        'GET',
      ),
      params: {
        orgId: org.id,
        projectId: project.id,
        studyId: 'study-1',
        fileName: 'document.pdf',
      },
    });

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toContain('document.pdf');
    const body = await res.arrayBuffer();
    expect(body.byteLength).toBe(5);
  });

  it('returns 404 when PDF not found', async () => {
    const { project, org, owner } = await buildProject();
    currentUser = { id: owner.id, email: owner.email };

    const res = await downloadHandler({
      request: req(
        `/api/orgs/${org.id}/projects/${project.id}/studies/study-1/pdfs/nonexistent.pdf`,
        'GET',
      ),
      params: {
        orgId: org.id,
        projectId: project.id,
        studyId: 'study-1',
        fileName: 'nonexistent.pdf',
      },
    });

    expect(res.status).toBe(404);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('FILE_NOT_FOUND');
  });
});

describe('DELETE /api/orgs/:orgId/projects/:projectId/studies/:studyId/pdfs/:fileName', () => {
  it('deletes PDF successfully', async () => {
    const { project, org, owner } = await buildProject();
    currentUser = { id: owner.id, email: owner.email };

    await seedMediaFile({
      id: 'media-1',
      filename: 'document.pdf',
      originalName: 'document.pdf',
      fileType: 'application/pdf',
      fileSize: 1024,
      uploadedBy: owner.id,
      bucketKey: `projects/${project.id}/studies/study-1/document.pdf`,
      orgId: org.id,
      projectId: project.id,
      studyId: 'study-1',
      createdAt: Math.floor(Date.now() / 1000),
    });

    const key = `projects/${project.id}/studies/study-1/document.pdf`;
    await env.PDF_BUCKET.put(key, PDF_MAGIC, {
      httpMetadata: { contentType: 'application/pdf' },
    });

    const res = await deleteHandler({
      request: req(
        `/api/orgs/${org.id}/projects/${project.id}/studies/study-1/pdfs/document.pdf`,
        'DELETE',
      ),
      params: {
        orgId: org.id,
        projectId: project.id,
        studyId: 'study-1',
        fileName: 'document.pdf',
      },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);

    const db = createDb(env.DB);
    const mediaFile = await db
      .select()
      .from(mediaFiles)
      .where(
        and(
          eq(mediaFiles.projectId, project.id),
          eq(mediaFiles.studyId, 'study-1'),
          eq(mediaFiles.filename, 'document.pdf'),
        ),
      )
      .get();
    expect(mediaFile).toBeUndefined();

    const stored = await env.PDF_BUCKET.get(key);
    expect(stored).toBeNull();
  });
});
