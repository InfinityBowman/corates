/**
 * Project factory for tests
 */

import { seedProject, seedProjectMember, seedProjectInvitation } from '../helpers.js';
import { generateId, nowSec, withDefaults, nextCounter } from './utils.js';
import { buildUser } from './user.js';
import { buildOrg, buildOrgMember } from './org.js';

/**
 * Build a project with an owner
 *
 * Creates: user -> org -> org membership -> project -> project membership
 *
 * @param {Object} [options]
 * @param {Object} [options.project] - Project field overrides
 * @param {Object} [options.owner] - Owner user (created with org if not provided)
 * @param {Object} [options.org] - Org (created if not provided)
 * @returns {Promise<{project: Object, owner: Object, org: Object, membership: Object}>}
 *
 * @example
 * // Create project with all dependencies
 * const { project, owner, org } = await buildProject();
 *
 * // Create project in existing org
 * const { org, owner } = await buildOrg();
 * const { project } = await buildProject({ org, owner });
 *
 * // Create project with specific name
 * const { project } = await buildProject({ project: { name: 'My Project' } });
 */
export async function buildProject(options = {}) {
  const n = nextCounter();
  const ts = nowSec();

  // Create or use provided org (which creates owner)
  let org, owner;
  if (options.org) {
    org = options.org;
    owner = options.owner || (await buildUser());
    // Ensure owner is org member if not already
    if (options.owner && !options.skipOrgMembership) {
      try {
        await buildOrgMember({ orgId: org.id, user: owner, role: 'owner' });
      } catch (e) {
        // Ignore if already a member (UNIQUE constraint)
        if (!e.message?.includes('UNIQUE constraint')) throw e;
      }
    }
  } else {
    const orgResult = await buildOrg({ owner: options.owner });
    org = orgResult.org;
    owner = orgResult.owner;
  }

  // Create project
  const projectId = options.project?.id || generateId('proj');
  const projectName = options.project?.name || `Test Project ${n}`;

  const projectDefaults = {
    id: projectId,
    name: projectName,
    description: options.project?.description || `Description for ${projectName}`,
    orgId: org.id,
    createdBy: owner.id,
    createdAt: ts,
    updatedAt: ts,
  };

  const projectData = withDefaults(projectDefaults, options.project);
  await seedProject(projectData);

  // Create owner project membership
  const membershipId = generateId('pm');
  const membershipData = {
    id: membershipId,
    projectId: projectId,
    userId: owner.id,
    role: 'owner',
    joinedAt: ts,
  };
  await seedProjectMember(membershipData);

  return {
    project: projectData,
    owner,
    org,
    membership: membershipData,
  };
}

/**
 * Alias for buildProject - clearer name for common case
 */
export const buildProjectWithOwner = buildProject;

/**
 * Add a member to an existing project
 *
 * @param {Object} options
 * @param {string} options.projectId - Project ID
 * @param {string} options.orgId - Organization ID (for org membership)
 * @param {Object} [options.user] - User to add (created if not provided)
 * @param {string} [options.role='member'] - Role in project
 * @param {boolean} [options.skipOrgMembership=false] - Skip creating org membership
 * @returns {Promise<{user: Object, membership: Object}>}
 */
export async function buildProjectMember(options) {
  const { projectId, orgId, role = 'member', skipOrgMembership = false } = options;
  const ts = nowSec();

  const user = options.user || (await buildUser());

  // Ensure user is org member
  if (orgId && !skipOrgMembership) {
    try {
      await buildOrgMember({ orgId, user, role: 'member' });
    } catch (e) {
      // Ignore if already a member (UNIQUE constraint)
      if (!e.message?.includes('UNIQUE constraint')) throw e;
    }
  }

  // Add to project
  const membershipData = {
    id: generateId('pm'),
    projectId,
    userId: user.id,
    role,
    joinedAt: ts,
  };
  await seedProjectMember(membershipData);

  return {
    user,
    membership: membershipData,
  };
}

/**
 * Build a project with multiple members
 *
 * @param {Object} [options]
 * @param {number} [options.memberCount=2] - Number of additional members (besides owner)
 * @param {Object} [options.project] - Project field overrides
 * @returns {Promise<{project: Object, owner: Object, org: Object, members: Array}>}
 */
export async function buildProjectWithMembers(options = {}) {
  const { memberCount = 2, ...projectOptions } = options;

  const { project, owner, org, membership } = await buildProject(projectOptions);

  const members = [{ user: owner, membership, role: 'owner' }];

  for (let i = 0; i < memberCount; i++) {
    const { user, membership } = await buildProjectMember({
      projectId: project.id,
      orgId: org.id,
      role: 'member',
    });
    members.push({ user, membership, role: 'member' });
  }

  return { project, owner, org, members };
}

/**
 * Build a project invitation
 *
 * @param {Object} options
 * @param {string} options.orgId - Organization ID
 * @param {string} options.projectId - Project ID
 * @param {string} options.invitedBy - User ID who sent the invitation
 * @param {string} [options.email] - Email to invite (generated if not provided)
 * @param {string} [options.role='member'] - Project role
 * @param {string} [options.orgRole='member'] - Organization role
 * @param {boolean} [options.grantOrgMembership=true] - Whether to grant org membership on accept
 * @param {string} [options.token] - Invitation token (generated if not provided)
 * @param {number} [options.expiresAt] - Expiration timestamp (7 days from now if not provided)
 * @param {number|null} [options.acceptedAt=null] - When accepted (null = pending)
 * @param {string} [options.status='pending'] - Shortcut for common states: 'pending', 'accepted', 'expired'
 * @returns {Promise<Object>} The created invitation
 *
 * @example
 * // Create pending invitation
 * const invitation = await buildProjectInvitation({
 *   orgId: org.id,
 *   projectId: project.id,
 *   invitedBy: owner.id,
 * });
 *
 * // Create accepted invitation
 * const invitation = await buildProjectInvitation({
 *   orgId: org.id,
 *   projectId: project.id,
 *   invitedBy: owner.id,
 *   status: 'accepted',
 * });
 *
 * // Create expired invitation
 * const invitation = await buildProjectInvitation({
 *   orgId: org.id,
 *   projectId: project.id,
 *   invitedBy: owner.id,
 *   status: 'expired',
 * });
 */
export async function buildProjectInvitation(options) {
  const n = nextCounter();
  const ts = nowSec();

  const {
    orgId,
    projectId,
    invitedBy,
    email = `invitee${n}@example.com`,
    role = 'member',
    orgRole = 'member',
    grantOrgMembership = true,
    token = `token-${generateId('inv')}`,
    status = 'pending',
  } = options;

  let { expiresAt, acceptedAt } = options;

  // Handle status shortcut
  if (status === 'expired') {
    expiresAt = expiresAt ?? ts - 24 * 60 * 60; // Expired 1 day ago
    acceptedAt = acceptedAt ?? null;
  } else if (status === 'accepted') {
    expiresAt = expiresAt ?? ts + 7 * 24 * 60 * 60; // Valid for 7 days
    acceptedAt = acceptedAt ?? ts; // Accepted now
  } else {
    // pending
    expiresAt = expiresAt ?? ts + 7 * 24 * 60 * 60; // Valid for 7 days
    acceptedAt = acceptedAt ?? null;
  }

  const invitationData = {
    id: options.id || generateId('inv'),
    orgId,
    projectId,
    email,
    role,
    orgRole,
    grantOrgMembership: grantOrgMembership ? 1 : 0,
    token,
    invitedBy,
    expiresAt,
    acceptedAt,
    createdAt: ts,
  };

  await seedProjectInvitation(invitationData);

  return invitationData;
}
