import { eq, desc } from 'drizzle-orm';
import type { OrgId } from '@corates/shared/ids';
import { stripeEventLedger, type StripeEventLedgerEntry } from './schema';
import type { Database } from './client';

export const LedgerStatus = {
  RECEIVED: 'received',
  PROCESSED: 'processed',
  SKIPPED_DUPLICATE: 'skipped_duplicate',
  FAILED: 'failed',
  IGNORED_UNVERIFIED: 'ignored_unverified',
  IGNORED_TEST_MODE: 'ignored_test_mode',
} as const;

type LedgerStatusType = (typeof LedgerStatus)[keyof typeof LedgerStatus];

interface InsertLedgerEntryData {
  id: string;
  payloadHash: string;
  signaturePresent: boolean;
  route: string;
  requestId: string;
  status?: LedgerStatusType;
  error?: string | null;
  httpStatus?: number | null;
}

interface UpdateLedgerVerifiedFieldsData {
  stripeEventId: string | null;
  type: string | null;
  livemode: boolean | null;
  apiVersion: string | null;
  created: Date | null;
  status: LedgerStatusType;
  httpStatus?: number;
  error?: string | null;
  orgId?: OrgId | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeCheckoutSessionId?: string | null;
}

interface UpdateLedgerStatusData {
  status: LedgerStatusType;
  error?: string | null;
  httpStatus?: number | null;
}

interface QueryOptions {
  limit?: number;
  since?: Date;
}

export async function insertLedgerEntry(
  db: Database,
  data: InsertLedgerEntryData,
): Promise<StripeEventLedgerEntry> {
  const {
    id,
    payloadHash,
    signaturePresent,
    route,
    requestId,
    status = LedgerStatus.RECEIVED,
    error = null,
    httpStatus = null,
  } = data;

  const result = await db
    .insert(stripeEventLedger)
    .values({
      id,
      payloadHash,
      signaturePresent,
      receivedAt: new Date(),
      route,
      requestId,
      status,
      error,
      httpStatus,
      stripeEventId: null,
      type: null,
      livemode: null,
      apiVersion: null,
      created: null,
      processedAt: null,
      orgId: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      stripeCheckoutSessionId: null,
    })
    .returning()
    .get();

  return result;
}

export async function updateLedgerWithVerifiedFields(
  db: Database,
  id: string,
  data: UpdateLedgerVerifiedFieldsData,
): Promise<StripeEventLedgerEntry | null> {
  const {
    stripeEventId,
    type,
    livemode,
    apiVersion,
    created,
    status,
    httpStatus,
    error = null,
    orgId = null,
    stripeCustomerId = null,
    stripeSubscriptionId = null,
    stripeCheckoutSessionId = null,
  } = data;

  const updateData: Partial<typeof stripeEventLedger.$inferInsert> = {
    processedAt: new Date(),
    status,
    ...(httpStatus !== undefined && { httpStatus }),
    ...(error !== undefined && { error }),
  };

  if (status === LedgerStatus.PROCESSED) {
    Object.assign(updateData, {
      stripeEventId,
      type,
      livemode,
      apiVersion,
      created,
      orgId,
      stripeCustomerId,
      stripeSubscriptionId,
      stripeCheckoutSessionId,
    } satisfies Partial<typeof stripeEventLedger.$inferInsert>);
  }

  const result = await db
    .update(stripeEventLedger)
    .set(updateData)
    .where(eq(stripeEventLedger.id, id))
    .returning()
    .get();

  return result ?? null;
}

export async function updateLedgerStatus(
  db: Database,
  id: string,
  data: UpdateLedgerStatusData,
): Promise<StripeEventLedgerEntry | null> {
  const { status, error = null, httpStatus = null } = data;

  const result = await db
    .update(stripeEventLedger)
    .set({
      status,
      error,
      httpStatus,
      processedAt: new Date(),
    })
    .where(eq(stripeEventLedger.id, id))
    .returning()
    .get();

  return result ?? null;
}

export async function getLedgerByPayloadHash(
  db: Database,
  payloadHash: string,
): Promise<StripeEventLedgerEntry | null> {
  const result = await db
    .select()
    .from(stripeEventLedger)
    .where(eq(stripeEventLedger.payloadHash, payloadHash))
    .get();

  return result ?? null;
}

export async function getLedgerByStripeEventId(
  db: Database,
  stripeEventId: string,
): Promise<StripeEventLedgerEntry | null> {
  const result = await db
    .select()
    .from(stripeEventLedger)
    .where(eq(stripeEventLedger.stripeEventId, stripeEventId))
    .get();

  return result ?? null;
}

export async function getLedgerEntriesByOrgId(
  db: Database,
  orgId: OrgId,
  options: QueryOptions = {},
): Promise<StripeEventLedgerEntry[]> {
  const { limit = 50 } = options;

  const results = await db
    .select()
    .from(stripeEventLedger)
    .where(eq(stripeEventLedger.orgId, orgId))
    .orderBy(desc(stripeEventLedger.receivedAt))
    .limit(limit)
    .all();

  return results;
}
