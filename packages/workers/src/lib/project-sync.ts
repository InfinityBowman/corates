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

  const response = await projectDoc.fetch(
    new Request('https://internal/sync-member', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Request': 'true',
      },
      body: JSON.stringify({ action, member: memberData }),
    }),
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `[ProjectSync] sync-member failed for project ${projectId}: ${response.status} ${text}`,
    );
  }
}

export async function syncProjectToDO(
  env: Env,
  projectId: string,
  meta: ProjectMeta | null,
  members: ProjectMember[] | null,
): Promise<void> {
  const projectDoc = getProjectDocStub(env, projectId);

  const response = await projectDoc.fetch(
    new Request('https://internal/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Request': 'true',
      },
      body: JSON.stringify({ meta, members }),
    }),
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `[ProjectSync] sync failed for project ${projectId}: ${response.status} ${text}`,
    );
  }
}
