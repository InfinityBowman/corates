import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { projectWorkspace } from '@corates/workers/sync';
import { resetTestDatabase } from '@/__tests__/server/helpers';
import {
  buildUser,
  buildProject,
  buildProjectMember,
  resetCounter,
} from '@/__tests__/server/factories';
import { deleteAccount } from '@/server/functions/users.server';

let currentUser = { id: 'user-1', email: 'user1@example.com' };

function mockSession() {
  return {
    user: { id: currentUser.id, email: currentUser.email, name: 'Test User' },
    session: { id: 'test-session', userId: currentUser.id },
  };
}

async function clearR2(prefix: string) {
  const listed = await env.PDF_BUCKET.list({ prefix });
  for (const obj of listed.objects) {
    await env.PDF_BUCKET.delete(obj.key);
  }
}

async function seedWorkspaceStudy(projectId: string) {
  const now = Date.now();
  await projectWorkspace(env, projectId).import({
    formatVersion: 1,
    schemaVersion: 1,
    rows: [
      {
        tbl: 'studies',
        id: 'study-1',
        data: { id: 'study-1', name: 'Study 1', createdAt: now, updatedAt: now },
      },
    ],
  });
}

async function workspaceRowCount(projectId: string) {
  const snapshot = (await projectWorkspace(env, projectId).export()) as { rows: unknown[] };
  return snapshot.rows.length;
}

async function projectRow(projectId: string) {
  return env.DB.prepare('SELECT createdBy FROM projects WHERE id = ?1')
    .bind(projectId)
    .first<{ createdBy: string }>();
}

async function memberRole(projectId: string, userId: string) {
  const row = await env.DB.prepare(
    'SELECT role FROM project_members WHERE projectId = ?1 AND userId = ?2',
  )
    .bind(projectId, userId)
    .first<{ role: string }>();
  return row?.role ?? null;
}

beforeEach(async () => {
  await resetTestDatabase();
  resetCounter();
  await clearR2('projects/');
  currentUser = { id: 'user-1', email: 'user1@example.com' };
});

describe('DELETE /api/users/me', () => {
  it('deletes user account and cascades related rows', async () => {
    const { owner } = await buildProject();
    currentUser = { id: owner.id, email: owner.email };

    const result = await deleteAccount(createDb(env.DB), mockSession());

    expect(result.success).toBe(true);

    const userRow = await env.DB.prepare('SELECT * FROM user WHERE id = ?1').bind(owner.id).first();
    expect(userRow).toBeNull();

    const members = await env.DB.prepare('SELECT * FROM project_members WHERE userId = ?1')
      .bind(owner.id)
      .all();
    expect(members.results).toHaveLength(0);
  });

  it('wipes workspace content and R2 PDFs of projects the user alone belongs to', async () => {
    const { project, owner } = await buildProject();
    const pdfKey = `projects/${project.id}/studies/study-1/file.pdf`;
    await env.PDF_BUCKET.put(pdfKey, '%PDF-1.4');
    await seedWorkspaceStudy(project.id);
    expect(await workspaceRowCount(project.id)).toBe(1);

    currentUser = { id: owner.id, email: owner.email };
    await deleteAccount(createDb(env.DB), mockSession());

    expect(await projectRow(project.id)).toBeNull();
    expect(await env.PDF_BUCKET.get(pdfKey)).toBeNull();
    expect(await workspaceRowCount(project.id)).toBe(0);
  });

  it('hands a shared project to its other owner and keeps its content', async () => {
    const { project, owner, org } = await buildProject();
    const { user: coOwner } = await buildProjectMember({
      projectId: project.id,
      orgId: org.id,
      role: 'owner',
    });
    const pdfKey = `projects/${project.id}/studies/study-1/file.pdf`;
    await env.PDF_BUCKET.put(pdfKey, '%PDF-1.4');
    await seedWorkspaceStudy(project.id);

    currentUser = { id: owner.id, email: owner.email };
    await deleteAccount(createDb(env.DB), mockSession());

    expect((await projectRow(project.id))?.createdBy).toBe(coOwner.id);
    expect(await memberRole(project.id, coOwner.id)).toBe('owner');
    expect(await memberRole(project.id, owner.id)).toBeNull();
    expect(await env.PDF_BUCKET.get(pdfKey)).not.toBeNull();
    expect(await workspaceRowCount(project.id)).toBe(1);
  });

  it('promotes the longest-standing member when a shared project has no other owner', async () => {
    const { project, owner, org } = await buildProject();
    const { user: first } = await buildProjectMember({ projectId: project.id, orgId: org.id });
    const { user: second } = await buildProjectMember({ projectId: project.id, orgId: org.id });
    // Factories stamp joinedAt with second precision; make the order explicit.
    await env.DB.prepare('UPDATE project_members SET joinedAt = ?1 WHERE userId = ?2')
      .bind(1_000, first.id)
      .run();
    await env.DB.prepare('UPDATE project_members SET joinedAt = ?1 WHERE userId = ?2')
      .bind(2_000, second.id)
      .run();

    currentUser = { id: owner.id, email: owner.email };
    await deleteAccount(createDb(env.DB), mockSession());

    expect((await projectRow(project.id))?.createdBy).toBe(first.id);
    expect(await memberRole(project.id, first.id)).toBe('owner');
    expect(await memberRole(project.id, second.id)).toBe('member');
  });

  it('sets mediaFiles.uploadedBy to null instead of deleting the files', async () => {
    const { project, org } = await buildProject();
    const userToDelete = await buildUser({ email: 'todelete@example.com' });
    const nowSec = Math.floor(Date.now() / 1000);

    await env.DB.prepare(
      'INSERT INTO mediaFiles (id, filename, bucketKey, uploadedBy, orgId, projectId, createdAt) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)',
    )
      .bind('media-1', 'test.pdf', 'bucket-key-1', userToDelete.id, org.id, project.id, nowSec)
      .run();

    currentUser = { id: userToDelete.id, email: userToDelete.email };

    const result = await deleteAccount(createDb(env.DB), mockSession());
    expect(result.success).toBe(true);

    const mediaFile = await env.DB.prepare('SELECT * FROM mediaFiles WHERE id = ?1')
      .bind('media-1')
      .first<{ uploadedBy: string | null }>();
    expect(mediaFile).not.toBeNull();
    expect(mediaFile!.uploadedBy).toBeNull();
  });
});
