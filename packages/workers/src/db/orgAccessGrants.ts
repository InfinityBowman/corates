import { eq, and, isNull, desc } from 'drizzle-orm';
import { orgAccessGrants } from './schema';
import type { Database } from './client';
import type { InferSelectModel } from 'drizzle-orm';

export type OrgAccessGrant = InferSelectModel<typeof orgAccessGrants>;

export interface CreateGrantData {
  id: string;
  orgId: string;
  type: string;
  startsAt: Date;
  expiresAt: Date;
  stripeCheckoutSessionId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function getGrantsByOrgId(db: Database, orgId: string): Promise<OrgAccessGrant[]> {
  const results = await db
    .select()
    .from(orgAccessGrants)
    .where(eq(orgAccessGrants.orgId, orgId))
    .orderBy(desc(orgAccessGrants.createdAt))
    .all();

  return results;
}

export async function getActiveGrantsByOrgId(
  db: Database,
  orgId: string,
  now: Date | number,
): Promise<OrgAccessGrant[]> {
  const nowTimestamp = now instanceof Date ? Math.floor(now.getTime() / 1000) : now;
  const results = await db
    .select()
    .from(orgAccessGrants)
    .where(and(eq(orgAccessGrants.orgId, orgId), isNull(orgAccessGrants.revokedAt)))
    .orderBy(desc(orgAccessGrants.expiresAt))
    .all();

  return results.filter(grant => {
    const startsAt =
      grant.startsAt instanceof Date ? Math.floor(grant.startsAt.getTime() / 1000) : grant.startsAt;
    const expiresAt =
      grant.expiresAt instanceof Date
        ? Math.floor(grant.expiresAt.getTime() / 1000)
        : grant.expiresAt;
    return startsAt <= nowTimestamp && nowTimestamp < expiresAt;
  });
}

export async function getGrantById(db: Database, grantId: string): Promise<OrgAccessGrant | null> {
  const result = await db
    .select()
    .from(orgAccessGrants)
    .where(eq(orgAccessGrants.id, grantId))
    .get();

  return result ?? null;
}

export async function createGrant(db: Database, data: CreateGrantData): Promise<OrgAccessGrant> {
  const {
    id,
    orgId,
    type,
    startsAt,
    expiresAt,
    stripeCheckoutSessionId = null,
    metadata = null,
  } = data;

  const result = await db
    .insert(orgAccessGrants)
    .values({
      id,
      orgId,
      type,
      startsAt,
      expiresAt,
      stripeCheckoutSessionId,
      metadata: metadata ? JSON.stringify(metadata) : null,
      createdAt: new Date(),
    })
    .returning()
    .get();

  return result;
}

export async function updateGrantExpiresAt(
  db: Database,
  grantId: string,
  newExpiresAt: Date,
): Promise<OrgAccessGrant | null> {
  const result = await db
    .update(orgAccessGrants)
    .set({
      expiresAt: newExpiresAt,
    })
    .where(eq(orgAccessGrants.id, grantId))
    .returning()
    .get();

  return result ?? null;
}

export async function revokeGrant(db: Database, grantId: string): Promise<OrgAccessGrant | null> {
  const result = await db
    .update(orgAccessGrants)
    .set({
      revokedAt: new Date(),
    })
    .where(eq(orgAccessGrants.id, grantId))
    .returning()
    .get();

  return result ?? null;
}

export async function getGrantByOrgIdAndType(
  db: Database,
  orgId: string,
  type: string,
): Promise<OrgAccessGrant | null> {
  const result = await db
    .select()
    .from(orgAccessGrants)
    .where(and(eq(orgAccessGrants.orgId, orgId), eq(orgAccessGrants.type, type)))
    .orderBy(desc(orgAccessGrants.createdAt))
    .get();

  return result ?? null;
}

export async function getGrantByStripeCheckoutSessionId(
  db: Database,
  stripeCheckoutSessionId: string,
): Promise<OrgAccessGrant | null> {
  const result = await db
    .select()
    .from(orgAccessGrants)
    .where(eq(orgAccessGrants.stripeCheckoutSessionId, stripeCheckoutSessionId))
    .get();

  return result ?? null;
}
