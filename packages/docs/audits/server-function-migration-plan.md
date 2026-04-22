# Server Function Migration Plan

Migrate all REST route handlers (`createFileRoute` + `fetch()`) to TanStack Start `createServerFn` pattern.

**Pattern:** `.server.ts` (pure business logic) + `.functions.ts` (thin `createServerFn` wrappers) + delete old route file + update tests + update consumers.

**Started:** 2026-04-20

---

## Already Migrated

| Function | Source |
|----------|--------|
| `getUsage` | `billing.functions.ts` |
| `getSubscription` | `billing.functions.ts` |
| `getMembers` | `billing.functions.ts` |
| `checkCoupon` | `billing.functions.ts` |
| `checkPlanChange` | `billing.functions.ts` |

---

## Cannot Migrate (must stay as HTTP routes)

These routes need stable URLs, serve binary/HTML content, or are called by external systems.

| Route | Reason |
|-------|--------|
| `auth/$.ts` | better-auth catch-all proxy |
| `auth/stripe/webhook.ts` | Stripe webhook endpoint |
| `auth/verify-email.ts` | Email link target, returns HTML |
| `auth/session.ts` | Called by WebSocket clients |
| `$.ts` | 404 catch-all |
| `test/*` (8 routes) | E2E test fixtures |
| `users/avatar/$userId.ts` | Image URL for `<img>` tags |
| `orgs/.../pdfs/$fileName.ts` | PDF viewer URLs |
| `orgs/.../dev/export.ts` | Binary download |

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

## Batch 4: Google Drive + Account Merge (8 routes)

New files: `google-drive.server.ts`, `google-drive.functions.ts`, `account-merge.server.ts`, `account-merge.functions.ts`

- [ ] `google-drive/status.ts` (GET - connection status)
- [ ] `google-drive/disconnect.ts` (POST - disconnect)
- [ ] `google-drive/picker-token.ts` (GET - picker token)
- [ ] `google-drive/import.ts` (POST - import PDFs)
- [ ] `accounts/merge/initiate.ts` (POST - send verification code)
- [ ] `accounts/merge/verify.ts` (POST - verify code)
- [ ] `accounts/merge/complete.ts` (POST - complete merge)
- [ ] `accounts/merge/cancel.ts` (DELETE - cancel merge)

Tests: `google-drive.server.test.ts`, `merge.server.test.ts`
Client files: `api/google-drive.ts`, `api/account-merge.ts`

## Batch 5: Misc (3 routes)

- [ ] `invitations/accept.ts` (POST - accept invitation)
- [ ] `contact.ts` (POST - send contact form email)
- [ ] `db/users.ts` (GET - user list)

Tests: `accept.server.test.ts`, `contact.server.test.ts`, `db.server.test.ts`

## Batch 6: Orgs Core (5 routes)

New files: `orgs.server.ts`, `orgs.functions.ts`

- [ ] `orgs.ts` (POST - create organization)
- [ ] `orgs/$orgId.ts` (GET/PUT/DELETE - org CRUD)
- [ ] `orgs/$orgId/members.ts` (GET/POST - list/add members)
- [ ] `orgs/$orgId/members/$memberId.ts` (GET/PUT/DELETE - manage member)
- [ ] `orgs/$orgId/set-active.ts` (POST - set active org)

Tests: `orgs.server.test.ts`

## Batch 7: Orgs Projects + Members + Invitations (6 routes)

Extends: `orgs.server.ts`, `orgs.functions.ts` (or new `org-projects.server.ts`)

- [ ] `orgs/$orgId/projects.ts` (GET - list projects)
- [ ] `orgs/$orgId/projects/$projectId.ts` (GET/PUT/DELETE - project CRUD)
- [ ] `orgs/$orgId/projects/$projectId/members.ts` (GET/POST - project members)
- [ ] `orgs/$orgId/projects/$projectId/members/$userId.ts` (DELETE - remove member)
- [ ] `orgs/$orgId/projects/$projectId/invitations.ts` (GET/POST - invitations)
- [ ] `orgs/$orgId/projects/$projectId/invitations/$invitationId.ts` (PATCH/DELETE - manage invitation)

Tests: `projects.server.test.ts`, `members.server.test.ts`, `invitations.server.test.ts`

## Batch 8: Orgs Dev Tools + Studies (7 routes)

- [ ] `orgs/$orgId/projects/$projectId/dev/templates.ts` (GET - list templates)
- [ ] `orgs/$orgId/projects/$projectId/dev/apply-template.ts` (POST - apply template)
- [ ] `orgs/$orgId/projects/$projectId/dev/import.ts` (POST - import project data)
- [ ] `orgs/$orgId/projects/$projectId/dev/reset.ts` (POST - reset project)
- [ ] `orgs/$orgId/projects/$projectId/dev/add-study.ts` (POST - add study)
- [ ] `orgs/$orgId/projects/$projectId/studies/$studyId/pdfs.ts` (GET/POST - list/upload PDFs)

Tests: `apply-template.server.test.ts`, `pdfs.server.test.ts`

Note: `dev/export.ts` stays as HTTP route (binary download). `pdfs/$fileName.ts` stays as HTTP route (serves PDF files).

## Batch 9: Admin Users (8 routes)

New files: `admin/users.server.ts`, `admin/users.functions.ts`

- [ ] `admin/users.ts` (GET - list users with search/pagination)
- [ ] `admin/users/$userId.ts` (GET/DELETE - user details)
- [ ] `admin/users/$userId/ban.ts` (POST - ban user)
- [ ] `admin/users/$userId/unban.ts` (POST - unban user)
- [ ] `admin/users/$userId/impersonate.ts` (POST - start impersonation)
- [ ] `admin/users/$userId/sessions.ts` (GET - list sessions)
- [ ] `admin/users/$userId/sessions/$sessionId.ts` (DELETE - revoke session)
- [ ] `admin/stop-impersonation.ts` (POST - end impersonation)

Tests: `users.server.test.ts`, `stop-impersonation.server.test.ts`

## Batch 10: Admin Orgs (9 routes)

New files: `admin/orgs.server.ts`, `admin/orgs.functions.ts`

- [ ] `admin/orgs.ts` (GET - list organizations)
- [ ] `admin/orgs/$orgId.ts` (GET - org details)
- [ ] `admin/orgs/$orgId/billing.ts` (GET - org billing info)
- [ ] `admin/orgs/$orgId/billing/reconcile.ts` (POST - reconcile billing)
- [ ] `admin/orgs/$orgId/grants.ts` (GET - list grants)
- [ ] `admin/orgs/$orgId/grants/$grantId.ts` (GET - grant details)
- [ ] `admin/orgs/$orgId/grant-trial.ts` (POST - grant trial)
- [ ] `admin/orgs/$orgId/grant-single-project.ts` (POST - grant single project)
- [ ] `admin/orgs/$orgId/subscriptions.ts` (GET - list subscriptions)
- [ ] `admin/orgs/$orgId/subscriptions/$subscriptionId.ts` (GET - subscription detail)

Tests: `orgs.server.test.ts`, `billing.server.test.ts`

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

| Category | Routes | Status |
|----------|--------|--------|
| Already migrated | 5 | Done |
| Cannot migrate | ~13 | Stay as HTTP |
| Batch 2: Users | 5 (1 stays HTTP) | Done |
| Batch 3: Billing | 6 | Done |
| Batch 4: Google Drive + Merge | 8 | Pending |
| Batch 5: Misc | 3 | Pending |
| Batch 6: Orgs Core | 5 | Pending |
| Batch 7: Orgs Projects | 6 | Pending |
| Batch 8: Orgs Dev + Studies | 7 | Pending |
| Batch 9: Admin Users | 8 | Pending |
| Batch 10: Admin Orgs | 9-10 | Pending |
| Batch 11: Admin Projects + Stats | 10-11 | Pending |
| Batch 12: Admin Billing + DB + Storage | 16 | Pending |
| **Total migratable** | **~85** | |
