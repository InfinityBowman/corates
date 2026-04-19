/* eslint-disable no-redeclare -- Zod-brand idiom: each ID has both a value
   (the schema, e.g. `const UserId = z.string().brand<'UserId'>()`) and a
   type (e.g. `type UserId = z.infer<typeof UserId>`). ESLint's base rule
   doesn't distinguish the namespaces; TypeScript does. */
/**
 * Branded ID types for the primary entities in the CoRATES domain.
 *
 * Brands prevent the "passed projectId where userId was expected" class of
 * bug at compile time. They are nominal types over `string` — at runtime they
 * are still plain strings, so JSON serialization, fetch, and the wire format
 * are unaffected.
 *
 * Two ways to obtain a branded value:
 *   1. From the database — Drizzle columns are `.$type<XxxId>()` so query
 *      results return branded IDs automatically.
 *   2. From an external boundary (route param, request body, search param) —
 *      run the value through the matching Zod schema (`UserId.parse(raw)`)
 *      or use the schema in a `validateSearch` / `validateParams` config.
 *
 * Inside trusted code, prefer assignment-position type assertions
 * (`const id = raw as UserId`) only when crossing a boundary the type system
 * can't see — never to silence a type error in the middle of a function.
 *
 * Skipped IDs (keep as `string`):
 * - Better-Auth internal: `sessionId`, `accountId`, `verificationId`,
 *   `twoFactorId` — rarely passed around in app code.
 * - External: Stripe IDs (`stripeCustomerId`, `stripeSubscriptionId`,
 *   `stripeCheckoutSessionId`) — already namespaced by the field name.
 */
import { z } from 'zod';

export const UserId = z.string().brand<'UserId'>();
export type UserId = z.infer<typeof UserId>;

export const OrgId = z.string().brand<'OrgId'>();
export type OrgId = z.infer<typeof OrgId>;

export const ProjectId = z.string().brand<'ProjectId'>();
export type ProjectId = z.infer<typeof ProjectId>;

export const MediaFileId = z.string().brand<'MediaFileId'>();
export type MediaFileId = z.infer<typeof MediaFileId>;

export const StudyId = z.string().brand<'StudyId'>();
export type StudyId = z.infer<typeof StudyId>;

export const MemberId = z.string().brand<'MemberId'>();
export type MemberId = z.infer<typeof MemberId>;

export const ProjectMemberId = z.string().brand<'ProjectMemberId'>();
export type ProjectMemberId = z.infer<typeof ProjectMemberId>;

export const ProjectInvitationId = z.string().brand<'ProjectInvitationId'>();
export type ProjectInvitationId = z.infer<typeof ProjectInvitationId>;

export const OrgInvitationId = z.string().brand<'OrgInvitationId'>();
export type OrgInvitationId = z.infer<typeof OrgInvitationId>;

export const SubscriptionId = z.string().brand<'SubscriptionId'>();
export type SubscriptionId = z.infer<typeof SubscriptionId>;

export const OrgAccessGrantId = z.string().brand<'OrgAccessGrantId'>();
export type OrgAccessGrantId = z.infer<typeof OrgAccessGrantId>;
