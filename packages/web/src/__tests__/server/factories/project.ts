import type {
  OrgId,
  ProjectId,
  ProjectMemberId,
  ProjectInvitationId,
  UserId,
} from '@corates/shared/ids';
import type { SeedProjectInput } from '../seed-schemas.js';
import { seedProject, seedProjectMember, seedProjectInvitation } from '../helpers.js';
import {
  generateId,
  nowSec,
  withDefaults,
  nextCounter,
  asProjectId,
  asProjectMemberId,
  asProjectInvitationId,
} from './utils.js';
import { buildUser } from './user.js';
import type { BuiltUser } from './user.js';
import { buildOrg, buildOrgMember } from './org.js';
import type { BuiltOrg } from './org.js';

export interface BuiltProject {
  id: ProjectId;
  name: string;
  description: string | null;
  orgId: OrgId | null;
  createdBy: UserId;
  createdAt: number;
  updatedAt: number;
}

export interface BuiltProjectMembership {
  id: ProjectMemberId;
  projectId: ProjectId;
  userId: UserId;
  role: 'owner' | 'member';
  joinedAt: number;
}

interface BuiltProjectInvitation {
  id: ProjectInvitationId;
  orgId: OrgId;
  projectId: ProjectId;
  email: string;
  role: 'owner' | 'member';
  orgRole: 'owner' | 'admin' | 'member';
  grantOrgMembership: number;
  token: string;
  invitedBy: UserId;
  expiresAt: number;
  acceptedAt: number | null;
  createdAt: number;
}

interface BuildProjectOptions {
  project?: Partial<SeedProjectInput>;
  owner?: BuiltUser;
  org?: BuiltOrg;
  skipOrgMembership?: boolean;
}

interface BuildProjectResult {
  project: BuiltProject;
  owner: BuiltUser;
  org: BuiltOrg;
  membership: BuiltProjectMembership;
}

export async function buildProject(options: BuildProjectOptions = {}): Promise<BuildProjectResult> {
  const n = nextCounter();
  const ts = nowSec();

  let org: BuiltOrg;
  let owner: BuiltUser;
  if (options.org) {
    org = options.org;
    owner = options.owner || (await buildUser());
    if (!options.skipOrgMembership) {
      try {
        await buildOrgMember({ orgId: org.id, user: owner, role: 'owner' });
      } catch (err: unknown) {
        if (!(err instanceof Error) || !err.message.includes('UNIQUE constraint')) throw err;
      }
    }
  } else {
    const orgResult = await buildOrg({ owner: options.owner });
    org = orgResult.org;
    owner = orgResult.owner;
  }

  const projectId = asProjectId(options.project?.id || generateId('proj'));
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

  const membershipId = asProjectMemberId(generateId('pm'));
  const membershipData: BuiltProjectMembership = {
    id: membershipId,
    projectId: projectId,
    userId: owner.id,
    role: 'owner',
    joinedAt: ts,
  };
  await seedProjectMember(membershipData);

  return {
    project: projectData as BuiltProject,
    owner,
    org,
    membership: membershipData,
  };
}

interface BuildProjectMemberOptions {
  projectId: ProjectId;
  orgId: OrgId;
  user?: BuiltUser;
  role?: 'owner' | 'member';
  skipOrgMembership?: boolean;
}

interface BuildProjectMemberResult {
  user: BuiltUser;
  membership: BuiltProjectMembership;
}

export async function buildProjectMember(
  options: BuildProjectMemberOptions,
): Promise<BuildProjectMemberResult> {
  const { projectId, orgId, role = 'member', skipOrgMembership = false } = options;
  const ts = nowSec();

  const user = options.user || (await buildUser());

  if (orgId && !skipOrgMembership) {
    try {
      await buildOrgMember({ orgId, user, role: 'member' });
    } catch (err: unknown) {
      if (!(err instanceof Error) || !err.message.includes('UNIQUE constraint')) throw err;
    }
  }

  const membershipData: BuiltProjectMembership = {
    id: asProjectMemberId(generateId('pm')),
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

interface ProjectMemberEntry {
  user: BuiltUser;
  membership: BuiltProjectMembership;
  role: string;
}

interface BuildProjectWithMembersOptions extends BuildProjectOptions {
  memberCount?: number;
}

interface BuildProjectWithMembersResult {
  project: BuiltProject;
  owner: BuiltUser;
  org: BuiltOrg;
  members: ProjectMemberEntry[];
}

export async function buildProjectWithMembers(
  options: BuildProjectWithMembersOptions = {},
): Promise<BuildProjectWithMembersResult> {
  const { memberCount = 2, ...projectOptions } = options;

  const { project, owner, org, membership } = await buildProject(projectOptions);

  const members: ProjectMemberEntry[] = [{ user: owner, membership, role: 'owner' }];

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

interface BuildProjectInvitationOptions {
  orgId: OrgId;
  projectId: ProjectId;
  invitedBy: UserId;
  id?: string;
  email?: string;
  role?: 'owner' | 'member';
  orgRole?: 'owner' | 'admin' | 'member';
  grantOrgMembership?: boolean;
  token?: string;
  expiresAt?: number;
  acceptedAt?: number | null;
  status?: 'pending' | 'accepted' | 'expired';
}

export async function buildProjectInvitation(
  options: BuildProjectInvitationOptions,
): Promise<BuiltProjectInvitation> {
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

  let expiresAt = options.expiresAt;
  let acceptedAt = options.acceptedAt;

  if (status === 'expired') {
    expiresAt = expiresAt ?? ts - 24 * 60 * 60;
    acceptedAt = acceptedAt ?? null;
  } else if (status === 'accepted') {
    expiresAt = expiresAt ?? ts + 7 * 24 * 60 * 60;
    acceptedAt = acceptedAt ?? ts;
  } else {
    expiresAt = expiresAt ?? ts + 7 * 24 * 60 * 60;
    acceptedAt = acceptedAt ?? null;
  }

  const invitationData: BuiltProjectInvitation = {
    id: asProjectInvitationId(options.id || generateId('inv')),
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
