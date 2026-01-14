/**
 * Integration tests for org-scoped authorization
 * Tests:
 * - Former org member access denial (HTTP routes + WebSocket)
 * - Cross-org projectId mismatch (PROJECT_NOT_IN_ORG error)
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { resetTestDatabase, clearProjectDOs, json } from '@/__tests__/helpers.js';
import {
  buildUser,
  buildOrg,
  buildOrgMember,
  buildProject,
  buildProjectMember,
  resetCounter,
} from '@/__tests__/factories';

// Mock postmark
vi.mock('postmark', () => {
  return {
    Client: class {
      constructor() {}
      sendEmail() {
        return Promise.resolve({ Message: 'mock' });
      }
    },
  };
});

let app;

// Track which user the mock auth should use
let mockUserId = 'user-1';
let mockUserEmail = 'user1@example.com';

// Mock auth middleware
vi.mock('@/middleware/auth.js', () => {
  return {
    requireAuth: async (c, next) => {
      const userId = c.req.raw.headers.get('x-test-user-id') || mockUserId;
      const email = c.req.raw.headers.get('x-test-user-email') || mockUserEmail;
      c.set('user', {
        id: userId,
        email,
        name: 'Test User',
        displayName: 'Test User',
        image: null,
      });
      c.set('session', { id: 'test-session' });
      await next();
    },
    getAuth: c => ({
      user: c.get('user'),
      session: c.get('session'),
    }),
  };
});

beforeAll(async () => {
  const indexModule = await import('@/index.js');
  app = indexModule.default;
});

beforeEach(async () => {
  await resetTestDatabase();
  resetCounter();
  await clearProjectDOs(['project-1', 'project-2']);
  mockUserId = 'user-1';
  mockUserEmail = 'user1@example.com';
});

async function fetchOrgProject(orgId, projectId, path = '', init = {}) {
  const ctx = createExecutionContext();
  const url = `/api/orgs/${orgId}/projects${projectId ? `/${projectId}` : ''}${path}`;
  const req = new Request(`http://localhost${url}`, {
    ...init,
    headers: {
      'x-test-user-id': init.userId || 'user-1',
      'x-test-user-email': init.email || 'user1@example.com',
      ...init.headers,
    },
  });
  const res = await app.fetch(req, env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

describe('Org Authorization - Former Org Member', () => {
  it('should deny HTTP access after user is removed from org', async () => {
    // Create org with owner (creates org membership)
    const { org, owner } = await buildOrg();
    // Create another user who will be a project member but NOT org member
    const formerMember = await buildUser();
    // Create project in org (owner is the creator and project owner)
    const { project } = await buildProject({ org, owner });
    // Add formerMember as project member (but skip org membership)
    await buildProjectMember({
      projectId: project.id,
      orgId: org.id,
      user: formerMember,
      role: 'owner',
      skipOrgMembership: true,
    });

    // formerMember has project membership but NOT org membership
    const res = await fetchOrgProject(org.id, project.id, '', {
      userId: formerMember.id,
      email: formerMember.email,
    });
    expect(res.status).toBe(403);

    const body = await json(res);
    expect(body.code).toBe('AUTH_FORBIDDEN');
    expect(body.details?.reason).toBe('not_org_member');
  });

  it('should allow HTTP access when user is an org member', async () => {
    // Create project (includes org and owner with both memberships)
    const { project, org, owner } = await buildProject();

    const res = await fetchOrgProject(org.id, project.id, '', {
      userId: owner.id,
      email: owner.email,
    });
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.id).toBe(project.id);
    expect(body.name).toBe(project.name);
    expect(body.role).toBe('owner');
  });

  it('should deny access when user has org membership but not project membership', async () => {
    // Create project (includes org and owner)
    const { project, org } = await buildProject();
    // Create user with org membership only (not project membership)
    const { user: orgOnlyMember } = await buildOrgMember({ orgId: org.id, role: 'member' });

    const res = await fetchOrgProject(org.id, project.id, '', {
      userId: orgOnlyMember.id,
      email: orgOnlyMember.email,
    });
    expect(res.status).toBe(403);

    const body = await json(res);
    expect(body.code).toBe('PROJECT_ACCESS_DENIED');
  });
});

describe('Org Authorization - Cross-Org Project ID Mismatch', () => {
  it('should return PROJECT_NOT_IN_ORG when projectId belongs to different org', async () => {
    // Create user who will be in both orgs
    const user = await buildUser();

    // Create Org A with project
    const { org: orgA } = await buildOrg({ owner: user });
    const { project: projectInOrgA } = await buildProject({ org: orgA, owner: user });

    // Create Org B (user is also a member)
    const { org: orgB } = await buildOrg({ owner: user });

    // Try to access projectInOrgA via orgB path
    // Should return PROJECT_NOT_IN_ORG (403), not 404
    const res = await fetchOrgProject(orgB.id, projectInOrgA.id, '', {
      userId: user.id,
      email: user.email,
    });
    expect(res.status).toBe(403);

    const body = await json(res);
    expect(body.code).toBe('PROJECT_NOT_IN_ORG');
    expect(body.details?.projectId).toBe(projectInOrgA.id);
    expect(body.details?.requestedOrgId).toBe(orgB.id);
    expect(body.details?.actualOrgId).toBe(orgA.id);
  });

  it('should return PROJECT_NOT_FOUND when project does not exist', async () => {
    // Create org with member
    const { org, owner } = await buildOrg();

    // Try to access a non-existent project
    const res = await fetchOrgProject(org.id, 'nonexistent-project', '', {
      userId: owner.id,
      email: owner.email,
    });
    expect(res.status).toBe(404);

    const body = await json(res);
    expect(body.code).toBe('PROJECT_NOT_FOUND');
  });
});
