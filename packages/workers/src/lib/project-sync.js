/**
 * Project sync utilities for syncing data to ProjectDoc Durable Objects
 */

import { getProjectDocStub } from './project-doc-id.js';

/**
 * Sync a member change to the Durable Object
 * @param {Env} env - Cloudflare environment
 * @param {string} projectId - Project ID
 * @param {'add' | 'update' | 'remove'} action - Action to perform
 * @param {object} memberData - Member data (userId, role, etc.)
 * @throws {Error} If sync fails
 */
export async function syncMemberToDO(env, projectId, action, memberData) {
  const projectDoc = getProjectDocStub(env, projectId);

  await projectDoc.fetch(
    new Request('https://internal/sync-member', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Request': 'true',
      },
      body: JSON.stringify({ action, member: memberData }),
    }),
  );
}

/**
 * Sync project metadata and members to the Durable Object
 * @param {Env} env - Cloudflare environment
 * @param {string} projectId - Project ID
 * @param {object | null} meta - Project metadata (name, description, updatedAt, etc.)
 * @param {object[] | null} members - Array of member objects
 * @throws {Error} If sync fails
 */
export async function syncProjectToDO(env, projectId, meta, members) {
  const projectDoc = getProjectDocStub(env, projectId);

  await projectDoc.fetch(
    new Request('https://internal/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Request': 'true',
      },
      body: JSON.stringify({ meta, members }),
    }),
  );
}
