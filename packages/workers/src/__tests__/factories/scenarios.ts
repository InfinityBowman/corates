import { buildUser } from './user.js';
import type { BuiltUser } from './user.js';
import { buildOrgMember } from './org.js';
import type { BuiltOrg } from './org.js';
import { buildProject, buildProjectMember, buildProjectWithMembers } from './project.js';
import type { BuiltProject, BuiltProjectMembership } from './project.js';

interface MemberRemovalScenario {
  project: BuiltProject;
  org: BuiltOrg;
  owner: BuiltUser;
  member: BuiltUser;
  ownerMembership: BuiltProjectMembership;
  memberMembership: BuiltProjectMembership;
}

export async function buildMemberRemovalScenario(): Promise<MemberRemovalScenario> {
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

interface LastOwnerScenario {
  project: BuiltProject;
  org: BuiltOrg;
  owner: BuiltUser;
  membership: BuiltProjectMembership;
}

export async function buildLastOwnerScenario(): Promise<LastOwnerScenario> {
  const { project, owner, org, membership } = await buildProject();

  return {
    project,
    org,
    owner,
    membership,
  };
}

interface MultipleOwnersScenario {
  project: BuiltProject;
  org: BuiltOrg;
  owner1: BuiltUser;
  owner2: BuiltUser;
  members: Array<{ user: BuiltUser; membership: BuiltProjectMembership; role: string }>;
}

export async function buildMultipleOwnersScenario(): Promise<MultipleOwnersScenario> {
  const { project, owner, org, membership } = await buildProject();

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

interface SelfRemovalScenario {
  project: BuiltProject;
  org: BuiltOrg;
  owner: BuiltUser;
  selfRemover: BuiltUser;
  selfRemoverMembership: BuiltProjectMembership;
}

export async function buildSelfRemovalScenario(): Promise<SelfRemovalScenario> {
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

interface NonMemberScenario {
  project: BuiltProject;
  org: BuiltOrg;
  owner: BuiltUser;
  nonMember: BuiltUser;
}

export async function buildNonMemberScenario(): Promise<NonMemberScenario> {
  const { project, owner, org } = await buildProject();
  const nonMember = await buildUser();

  return {
    project,
    org,
    owner,
    nonMember,
  };
}

interface OrgAdminScenario {
  project: BuiltProject;
  org: BuiltOrg;
  owner: BuiltUser;
  orgAdmin: BuiltUser;
}

export async function buildOrgAdminScenario(): Promise<OrgAdminScenario> {
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

interface CrossOrgScenario {
  org1: BuiltOrg;
  project1: BuiltProject;
  owner1: BuiltUser;
  org2: BuiltOrg;
  project2: BuiltProject;
  owner2: BuiltUser;
}

export async function buildCrossOrgScenario(): Promise<CrossOrgScenario> {
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
