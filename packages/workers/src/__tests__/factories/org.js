/**
 * Organization factory for tests
 */

import { seedOrganization, seedOrgMember } from '../helpers.js';
import { generateId, nowSec, withDefaults, slugify, nextCounter } from './utils.js';
import { buildUser } from './user.js';

/**
 * Build an organization with an owner
 *
 * @param {Object} [options]
 * @param {Object} [options.org] - Org field overrides
 * @param {Object} [options.owner] - Owner user (created if not provided)
 * @param {string} [options.ownerRole='owner'] - Owner's role in org
 * @returns {Promise<{org: Object, owner: Object, membership: Object}>}
 *
 * @example
 * // Create org with auto-generated owner
 * const { org, owner } = await buildOrg();
 *
 * // Create org with existing user as owner
 * const user = await buildUser();
 * const { org } = await buildOrg({ owner: user });
 *
 * // Create org with specific name
 * const { org } = await buildOrg({ org: { name: 'My Team' } });
 */
export async function buildOrg(options = {}) {
  const n = nextCounter();
  const ts = nowSec();

  // Create or use provided owner
  const owner = options.owner || (await buildUser());

  // Create organization
  const orgId = options.org?.id || generateId('org');
  const orgName = options.org?.name || `Test Org ${n}`;

  const orgDefaults = {
    id: orgId,
    name: orgName,
    slug: slugify(orgName),
    logo: null,
    metadata: null,
    createdAt: ts,
  };

  const orgData = withDefaults(orgDefaults, options.org);
  await seedOrganization(orgData);

  // Create owner membership
  const membershipId = generateId('om');
  const membershipData = {
    id: membershipId,
    organizationId: orgId,
    userId: owner.id,
    role: options.ownerRole || 'owner',
    createdAt: ts,
  };
  await seedOrgMember(membershipData);

  return {
    org: orgData,
    owner,
    membership: membershipData,
  };
}

/**
 * Add a member to an existing organization
 *
 * @param {Object} options
 * @param {string} options.orgId - Organization ID
 * @param {Object} [options.user] - User to add (created if not provided)
 * @param {string} [options.role='member'] - Role in organization
 * @returns {Promise<{user: Object, membership: Object}>}
 */
export async function buildOrgMember(options) {
  const { orgId, role = 'member' } = options;
  const ts = nowSec();

  const user = options.user || (await buildUser());

  const membershipData = {
    id: generateId('om'),
    organizationId: orgId,
    userId: user.id,
    role,
    createdAt: ts,
  };
  await seedOrgMember(membershipData);

  return {
    user,
    membership: membershipData,
  };
}

/**
 * Build an organization with multiple members
 *
 * @param {Object} [options]
 * @param {number} [options.memberCount=2] - Number of additional members (besides owner)
 * @param {Object} [options.org] - Org field overrides
 * @returns {Promise<{org: Object, owner: Object, members: Array}>}
 */
export async function buildOrgWithMembers(options = {}) {
  const { memberCount = 2, ...orgOptions } = options;

  const { org, owner, membership } = await buildOrg(orgOptions);

  const members = [{ user: owner, membership, role: 'owner' }];

  for (let i = 0; i < memberCount; i++) {
    const { user, membership } = await buildOrgMember({
      orgId: org.id,
      role: 'member',
    });
    members.push({ user, membership, role: 'member' });
  }

  return { org, owner, members };
}
