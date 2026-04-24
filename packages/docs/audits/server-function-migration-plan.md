# Server Function Migration Plan

Migrate all REST route handlers (`createFileRoute` + `fetch()`) to TanStack Start `createServerFn` pattern.

**Pattern:** `.server.ts` (pure business logic) + `.functions.ts` (thin `createServerFn` wrappers) + delete old route file + update tests + update consumers.

**Started:** 2026-04-20

---

## Already Migrated

| Function          | Source                 |
| ----------------- | ---------------------- |
| `getUsage`        | `billing.functions.ts` |
| `getSubscription` | `billing.functions.ts` |
| `getMembers`      | `billing.functions.ts` |
| `checkCoupon`     | `billing.functions.ts` |
| `checkPlanChange` | `billing.functions.ts` |

---

## Cannot Migrate (must stay as HTTP routes)

These routes need stable URLs, serve binary/HTML content, or are called by external systems.

| Route                        | Reason                          |
| ---------------------------- | ------------------------------- |
| `auth/$.ts`                  | better-auth catch-all proxy     |
| `auth/stripe/webhook.ts`     | Stripe webhook endpoint         |
| `auth/verify-email.ts`       | Email link target, returns HTML |
| `auth/session.ts`            | Called by WebSocket clients     |
| `$.ts`                       | 404 catch-all                   |
| `test/*` (8 routes)          | E2E test fixtures               |
| `users/avatar/$userId.ts`    | Image URL for `<img>` tags      |
| `orgs/.../pdfs/$fileName.ts` | PDF viewer URLs                 |
| `orgs/.../dev/export.ts`     | Binary download                 |

**Needs assessment:** `pdf-proxy.ts` -- depends on whether clients need a URL or use fetch().

---

## Batch 2: Users (6 routes) -- DONE

New files: `users.server.ts`, `users.functions.ts`

- [x] `users/me.ts` (DELETE - delete current user account)
- [x] `users/me/projects.ts` (GET - current user's projects)
- [x] `users/$userId/projects.ts` (GET - specific user's projects)
- [x] `users/search.ts` (GET - search users by email/name)
- [ ] `users/avatar.ts` (POST - upload avatar) -- stays as HTTP (FormData)
- [x] `users/sync-profile.ts` (POST - sync profile from auth provider)

Tests: `me.server.test.ts`, `avatar.server.test.ts`, `search.server.test.ts`, `userId-projects.server.test.ts`
Client file: none (consumers call fetch directly or use hooks)

## Batch 3: Remaining Billing (6 routes) -- DONE

Extends: `billing.server.ts`, `billing.functions.ts`

- [x] `billing/checkout.ts` (POST - create Stripe checkout session)
- [x] `billing/invoices.ts` (GET - fetch org invoices)
- [x] `billing/portal.ts` (POST - create Stripe portal session)
- [x] `billing/single-project/checkout.ts` (POST - single-project checkout)
- [x] `billing/trial/start.ts` (POST - start trial)
- [x] `billing/sync-after-success.ts` (POST - sync subscription post-checkout)

Tests: `checkout.server.test.ts`, `invoices.server.test.ts`, `portal.server.test.ts`, `single-project-checkout.server.test.ts`, `trial-start.server.test.ts`, `sync-after-success.server.test.ts`
Client file: `api/billing.ts` (updated to call server functions)

## Batch 4: Google Drive + Account Merge (8 routes) -- DONE

New files: `google-drive.server.ts`, `google-drive.functions.ts`, `account-merge.server.ts`, `account-merge.functions.ts`

- [x] `google-drive/status.ts` (GET - connection status)
- [x] `google-drive/disconnect.ts` (POST - disconnect)
- [x] `google-drive/picker-token.ts` (GET - picker token)
- [x] `google-drive/import.ts` (POST - import PDFs)
- [x] `accounts/merge/initiate.ts` (POST - send verification code)
- [x] `accounts/merge/verify.ts` (POST - verify code)
- [x] `accounts/merge/complete.ts` (POST - complete merge)
- [x] `accounts/merge/cancel.ts` (DELETE - cancel merge)

Tests: `google-drive.server.test.ts`, `merge.server.test.ts`
Client files: `api/google-drive.ts`, `api/account-merge.ts`

## Batch 5: Misc (3 routes) -- DONE

- [x] `invitations/accept.ts` (POST - accept invitation)
- [x] `contact.ts` (POST - send contact form email)
- [x] `db/users.ts` (GET - user list)

Tests: `accept.server.test.ts`, `contact.server.test.ts`, `db.server.test.ts`

## Batch 6: Orgs Core (5 routes) -- DONE

New files: `orgs.server.ts`, `orgs.functions.ts`

- [x] `orgs.ts` (POST - create organization)
- [x] `orgs/$orgId.ts` (GET/PUT/DELETE - org CRUD)
- [x] `orgs/$orgId/members.ts` (GET/POST - list/add members)
- [x] `orgs/$orgId/members/$memberId.ts` (GET/PUT/DELETE - manage member)
- [x] `orgs/$orgId/set-active.ts` (POST - set active org)

Tests: `orgs.server.test.ts`

## Batch 7: Orgs Projects + Members + Invitations (6 routes) -- DONE

New files: `org-projects.server.ts`, `org-projects.functions.ts`

- [x] `orgs/$orgId/projects.ts` (GET - list projects)
- [x] `orgs/$orgId/projects/$projectId.ts` (GET/PUT/DELETE - project CRUD)
- [x] `orgs/$orgId/projects/$projectId/members.ts` (GET/POST - project members)
- [x] `orgs/$orgId/projects/$projectId/members/$userId.ts` (PUT/DELETE - manage member)
- [x] `orgs/$orgId/projects/$projectId/invitations.ts` (GET/POST - invitations)
- [x] `orgs/$orgId/projects/$projectId/invitations/$invitationId.ts` (DELETE - cancel invitation)

Tests: `projects.server.test.ts`, `members.server.test.ts`, `invitations.server.test.ts`

## Batch 8: Orgs Dev Tools + Studies (7 routes) -- DONE

New files: `dev-tools.server.ts`, `dev-tools.functions.ts`

- [x] `orgs/$orgId/projects/$projectId/dev/templates.ts` (GET - list templates)
- [x] `orgs/$orgId/projects/$projectId/dev/apply-template.ts` (POST - apply template)
- [x] `orgs/$orgId/projects/$projectId/dev/import.ts` (POST - import project data)
- [x] `orgs/$orgId/projects/$projectId/dev/reset.ts` (POST - reset project)
- [x] `orgs/$orgId/projects/$projectId/dev/add-study.ts` (POST - add study) -- route kept for e2e helpers
- [ ] `orgs/$orgId/projects/$projectId/studies/$studyId/pdfs.ts` (GET/POST - list/upload PDFs) -- stays as HTTP (FormData upload, no frontend GET consumer)

Tests: `apply-template.server.test.ts` removed (Zod handles validation). `pdfs.server.test.ts` unchanged.

Note: `dev/export.ts` stays as HTTP route (binary download). `pdfs/$fileName.ts` stays as HTTP route (serves PDF files). `dev/add-study.ts` route kept alongside server function because e2e `seedStudies` helper calls it via HTTP.

## Batch 9: Admin Users (8 routes) -- DONE

New files: `admin-users.server.ts`, `admin-users.functions.ts`

- [x] `admin/users.ts` (GET - list users with search/pagination)
- [x] `admin/users/$userId.ts` (GET/DELETE - user details)
- [x] `admin/users/$userId/ban.ts` (POST - ban user)
- [x] `admin/users/$userId/unban.ts` (POST - unban user)
- [x] `admin/users/$userId/impersonate.ts` (POST - start impersonation)
- [x] `admin/users/$userId/sessions.ts` (DELETE - revoke all sessions)
- [x] `admin/users/$userId/sessions/$sessionId.ts` (DELETE - revoke session)
- [x] `admin/stop-impersonation.ts` (POST - end impersonation)

Tests: `users.server.test.ts`, `stop-impersonation.server.test.ts` (CSRF tests removed, now handled by framework)

Note: Impersonate and stop-impersonation proxy to better-auth. Cookie forwarding handled via `getResponse().headers.append()` in the `.functions.ts` wrapper.

## Batch 10: Admin Orgs (10 routes) -- DONE

New files: `admin-orgs.server.ts`, `admin-orgs.functions.ts`

- [x] `admin/orgs.ts` (GET - list organizations)
- [x] `admin/orgs/$orgId.ts` (GET - org details)
- [x] `admin/orgs/$orgId/billing.ts` (GET - org billing info)
- [x] `admin/orgs/$orgId/billing/reconcile.ts` (GET - reconcile billing)
- [x] `admin/orgs/$orgId/grants.ts` (POST - create grant)
- [x] `admin/orgs/$orgId/grants/$grantId.ts` (PUT/DELETE - update/revoke grant)
- [x] `admin/orgs/$orgId/grant-trial.ts` (POST - grant trial)
- [x] `admin/orgs/$orgId/grant-single-project.ts` (POST - grant single project)
- [x] `admin/orgs/$orgId/subscriptions.ts` (POST - create subscription)
- [x] `admin/orgs/$orgId/subscriptions/$subscriptionId.ts` (PUT/DELETE - update/cancel subscription)

Tests: `orgs.server.test.ts`, `billing.server.test.ts`, `billing-observability.server.test.ts` (reconcile tests migrated)

Note: Fixed `updateGrantExpiresAt` and `revokeGrant` return types in `@corates/db` to be non-nullable. Branded types (`OrgId`, `OrgAccessGrantId`) used in function signatures, cast at the `functions.ts` boundary.

## Batch 11: Admin Projects + Stats (10 routes)

New files: `admin/projects.server.ts`, `admin/projects.functions.ts`, `admin/stats.server.ts`, `admin/stats.functions.ts`

- [ ] `admin/projects.ts` (GET - list projects)
- [ ] `admin/projects/$projectId.ts` (GET - project details)
- [ ] `admin/projects/$projectId/doc-stats.ts` (GET - document stats)
- [ ] `admin/projects/$projectId/members/$memberId.ts` (DELETE - remove member)
- [ ] `admin/stats.ts` (GET - overall stats)
- [ ] `admin/stats/signups.ts` (GET - signup analytics)
- [ ] `admin/stats/revenue.ts` (GET - revenue analytics)
- [ ] `admin/stats/projects.ts` (GET - project analytics)
- [ ] `admin/stats/organizations.ts` (GET - org analytics)
- [ ] `admin/stats/subscriptions.ts` (GET - subscription analytics)
- [ ] `admin/stats/webhooks.ts` (GET - webhook analytics)

Tests: `projects.server.test.ts`, `projects-self.server.test.ts`, `stats.server.test.ts`

## Batch 12: Admin Billing + Stripe + Database + Storage (16 routes)

New files: `admin/billing.server.ts`, `admin/billing.functions.ts`, `admin/database.server.ts`, `admin/database.functions.ts`

- [ ] `admin/billing/ledger.ts` (GET - Stripe event ledger)
- [ ] `admin/billing/stuck-states.ts` (GET - stuck billing states)
- [ ] `admin/stripe/customer.ts` (GET - Stripe customer details)
- [ ] `admin/stripe/portal-link.ts` (POST - create portal link)
- [ ] `admin/stripe/customer/$customerId/invoices.ts` (GET - customer invoices)
- [ ] `admin/stripe/customer/$customerId/payment-methods.ts` (GET - payment methods)
- [ ] `admin/stripe/customer/$customerId/subscriptions.ts` (GET - subscriptions)
- [ ] `admin/database/tables.ts` (GET - list tables)
- [ ] `admin/database/tables/$tableName/schema.ts` (GET - table schema)
- [ ] `admin/database/tables/$tableName/rows.ts` (GET - table rows)
- [ ] `admin/database/analytics/pdfs-by-org.ts` (GET - PDF usage by org)
- [ ] `admin/database/analytics/pdfs-by-project.ts` (GET - PDF usage by project)
- [ ] `admin/database/analytics/pdfs-by-user.ts` (GET - PDF usage by user)
- [ ] `admin/database/analytics/recent-uploads.ts` (GET - recent uploads)
- [ ] `admin/storage/stats.ts` (GET - storage stats)
- [ ] `admin/storage/documents.ts` (GET - list documents)

Tests: `billing-observability.server.test.ts`, `stripe-tools.server.test.ts`, `database.server.test.ts`, `storage.server.test.ts`

---

## Summary

| Category                               | Routes                                 | Status       |
| -------------------------------------- | -------------------------------------- | ------------ |
| Already migrated                       | 5                                      | Done         |
| Cannot migrate                         | ~13                                    | Stay as HTTP |
| Batch 2: Users                         | 5 (1 stays HTTP)                       | Done         |
| Batch 3: Billing                       | 6                                      | Done         |
| Batch 4: Google Drive + Merge          | 8                                      | Done         |
| Batch 5: Misc                          | 3                                      | Done         |
| Batch 6: Orgs Core                     | 5                                      | Done         |
| Batch 7: Orgs Projects                 | 6                                      | Done         |
| Batch 8: Orgs Dev + Studies            | 5 migrated, 1 kept (e2e), 1 stays HTTP | Done         |
| Batch 9: Admin Users                   | 8                                      | Done         |
| Batch 10: Admin Orgs                   | 10                                     | Done         |
| Batch 11: Admin Projects + Stats       | 10-11                                  | Pending      |
| Batch 12: Admin Billing + DB + Storage | 16                                     | Pending      |
| **Total migratable**                   | **~85**                                |              |
