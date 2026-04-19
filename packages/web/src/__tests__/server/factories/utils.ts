import type {
  OrgId,
  OrgAccessGrantId,
  ProjectId,
  UserId,
  MediaFileId,
  StudyId,
  SubscriptionId,
  ProjectInvitationId,
  ProjectMemberId,
  MemberId,
} from '@corates/shared/ids';

export function generateId(prefix = ''): string {
  const uuid = crypto.randomUUID();
  return prefix ? `${prefix}-${uuid.slice(0, 8)}` : uuid;
}

// Test-only branded-ID constructors. Production code obtains branded IDs from
// Drizzle row reads or schema parses — never via these casts.
export const asOrgId = (s: string) => s as OrgId;
export const asUserId = (s: string) => s as UserId;
export const asProjectId = (s: string) => s as ProjectId;
export const asMediaFileId = (s: string) => s as MediaFileId;
export const asStudyId = (s: string) => s as StudyId;
export const asGrantId = (s: string) => s as OrgAccessGrantId;
export const asSubscriptionId = (s: string) => s as SubscriptionId;
export const asProjectInvitationId = (s: string) => s as ProjectInvitationId;
export const asProjectMemberId = (s: string) => s as ProjectMemberId;
export const asMemberId = (s: string) => s as MemberId;

export function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

export function nowDate(): Date {
  return new Date();
}

export function withDefaults<T extends Record<string, unknown>>(
  defaults: T,
  overrides: Record<string, unknown> = {},
): T {
  return { ...defaults, ...overrides } as T;
}

export function emailFromId(id: string): string {
  return `${id}@test.example.com`;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

let counter = 0;

export function nextCounter(): number {
  return ++counter;
}

export function resetCounter(): void {
  counter = 0;
}
