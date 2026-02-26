import { getProjectDocStub } from './project-doc-id';
import type { Env } from '../types';

interface MemberData {
  userId: string;
  role?: string;
  [key: string]: unknown;
}

interface ProjectMeta {
  name?: string;
  description?: string | null;
  updatedAt?: number;
  createdAt?: number;
  [key: string]: unknown;
}

interface ProjectMember {
  userId: string;
  role: string;
  [key: string]: unknown;
}

export async function syncMemberToDO(
  env: Env,
  projectId: string,
  action: 'add' | 'update' | 'remove',
  memberData: MemberData,
): Promise<void> {
  const projectDoc = getProjectDocStub(env, projectId);
  await projectDoc.syncMember(action, memberData);
}

export async function syncProjectToDO(
  env: Env,
  projectId: string,
  meta: ProjectMeta | null,
  members: ProjectMember[] | null,
): Promise<void> {
  const projectDoc = getProjectDocStub(env, projectId);
  await projectDoc.syncProject({ meta: meta ?? undefined, members: members ?? undefined });
}
