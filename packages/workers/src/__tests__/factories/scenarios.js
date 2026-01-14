/**
 * Complex test scenario factories
 *
 * These create complete test setups for specific test cases.
 */

import { buildUser } from './user.js';
import { buildOrgMember } from './org.js';
import { buildProject, buildProjectMember, buildProjectWithMembers } from './project.js';

/**
 * Create scenario for testing member removal
 *
 * Returns an owner who can remove a member, and a member who can be removed.
 *
 * @returns {Promise<{project, org, owner, member, ownerMembership, memberMembership}>}
 */
export async function buildMemberRemovalScenario() {
  const { project, owner, org, members } = await buildProjectWithMembers({ memberCount: 1 });

  return {
    project,
    org,
    owner,
    member: members[1].user,
    ownerMembership: members[0].membership,
    memberMembership: members[1].membership,
  };
}

/**
 * Create scenario for testing "last owner" protection
 *
 * Returns a project with only one owner (who cannot be demoted/removed).
 *
 * @returns {Promise<{project, org, owner, membership}>}
 */
export async function buildLastOwnerScenario() {
  const { project, owner, org, membership } = await buildProject();

  return {
    project,
    org,
    owner,
    membership,
  };
}

/**
 * Create scenario for testing owner demotion (multiple owners)
 *
 * Returns a project with two owners (one can be demoted).
 *
 * @returns {Promise<{project, org, owner1, owner2, members}>}
 */
export async function buildMultipleOwnersScenario() {
  const { project, owner, org, membership } = await buildProject();

  // Add second owner
  const { user: owner2, membership: membership2 } = await buildProjectMember({
    projectId: project.id,
    orgId: org.id,
    role: 'owner',
  });

  return {
    project,
    org,
    owner1: owner,
    owner2,
    members: [
      { user: owner, membership, role: 'owner' },
      { user: owner2, membership: membership2, role: 'owner' },
    ],
  };
}

/**
 * Create scenario for testing self-removal
 *
 * Returns a member who can remove themselves from a project.
 *
 * @returns {Promise<{project, org, owner, selfRemover, selfRemoverMembership}>}
 */
export async function buildSelfRemovalScenario() {
  const { project, owner, org } = await buildProject();

  const { user: selfRemover, membership: selfRemoverMembership } = await buildProjectMember({
    projectId: project.id,
    orgId: org.id,
    role: 'member',
  });

  return {
    project,
    org,
    owner,
    selfRemover,
    selfRemoverMembership,
  };
}

/**
 * Create scenario for testing non-member access denial
 *
 * Returns a project and a user who is NOT a member.
 *
 * @returns {Promise<{project, org, owner, nonMember}>}
 */
export async function buildNonMemberScenario() {
  const { project, owner, org } = await buildProject();
  const nonMember = await buildUser();

  return {
    project,
    org,
    owner,
    nonMember,
  };
}

/**
 * Create scenario for testing org role inheritance
 *
 * Returns an org admin who is not a project member.
 *
 * @returns {Promise<{project, org, owner, orgAdmin}>}
 */
export async function buildOrgAdminScenario() {
  const { project, owner, org } = await buildProject();

  const { user: orgAdmin } = await buildOrgMember({
    orgId: org.id,
    role: 'admin',
  });

  return {
    project,
    org,
    owner,
    orgAdmin,
  };
}

/**
 * Create scenario for testing cross-org access denial
 *
 * Returns two separate orgs with projects, for testing isolation.
 *
 * @returns {Promise<{org1, project1, owner1, org2, project2, owner2}>}
 */
export async function buildCrossOrgScenario() {
  const result1 = await buildProject();
  const result2 = await buildProject();

  return {
    org1: result1.org,
    project1: result1.project,
    owner1: result1.owner,
    org2: result2.org,
    project2: result2.project,
    owner2: result2.owner,
  };
}
