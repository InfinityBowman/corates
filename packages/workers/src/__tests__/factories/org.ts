import type { SeedOrganizationInput } from '../seed-schemas.js';
import { seedOrganization, seedOrgMember } from '../helpers.js';
import { generateId, nowSec, withDefaults, slugify, nextCounter } from './utils.js';
import { buildUser } from './user.js';
import type { BuiltUser } from './user.js';

export interface BuiltOrg {
  id: string;
  name: string;
  slug: string | null;
  logo: string | null;
  metadata: string | null;
  createdAt: number;
}

export interface BuiltOrgMembership {
  id: string;
  organizationId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
  createdAt: number;
}

interface BuildOrgOptions {
  org?: Partial<SeedOrganizationInput>;
  owner?: BuiltUser;
  ownerRole?: 'owner' | 'admin' | 'member';
}

interface BuildOrgResult {
  org: BuiltOrg;
  owner: BuiltUser;
  membership: BuiltOrgMembership;
}

export async function buildOrg(options: BuildOrgOptions = {}): Promise<BuildOrgResult> {
  const n = nextCounter();
  const ts = nowSec();

  const owner = options.owner || (await buildUser());

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

  const membershipId = generateId('om');
  const membershipData: BuiltOrgMembership = {
    id: membershipId,
    organizationId: orgId,
    userId: owner.id,
    role: options.ownerRole || 'owner',
    createdAt: ts,
  };
  await seedOrgMember(membershipData);

  return {
    org: orgData as BuiltOrg,
    owner,
    membership: membershipData,
  };
}

interface BuildOrgMemberOptions {
  orgId: string;
  user?: BuiltUser;
  role?: 'owner' | 'admin' | 'member';
}

interface BuildOrgMemberResult {
  user: BuiltUser;
  membership: BuiltOrgMembership;
}

export async function buildOrgMember(
  options: BuildOrgMemberOptions,
): Promise<BuildOrgMemberResult> {
  const { orgId, role = 'member' } = options;
  const ts = nowSec();

  const user = options.user || (await buildUser());

  const membershipData: BuiltOrgMembership = {
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

interface OrgMemberEntry {
  user: BuiltUser;
  membership: BuiltOrgMembership;
  role: string;
}

interface BuildOrgWithMembersOptions extends BuildOrgOptions {
  memberCount?: number;
}

interface BuildOrgWithMembersResult {
  org: BuiltOrg;
  owner: BuiltUser;
  members: OrgMemberEntry[];
}

export async function buildOrgWithMembers(
  options: BuildOrgWithMembersOptions = {},
): Promise<BuildOrgWithMembersResult> {
  const { memberCount = 2, ...orgOptions } = options;

  const { org, owner, membership } = await buildOrg(orgOptions);

  const members: OrgMemberEntry[] = [{ user: owner, membership, role: 'owner' }];

  for (let i = 0; i < memberCount; i++) {
    const { user, membership } = await buildOrgMember({
      orgId: org.id,
      role: 'member',
    });
    members.push({ user, membership, role: 'member' });
  }

  return { org, owner, members };
}
