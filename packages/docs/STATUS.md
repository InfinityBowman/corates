# CoRATES Implementation Status

**Last Updated:** 2025-01-15

This document tracks the current implementation status of CoRATES features and systems.

---

## Current Focus

**Pre-production readiness** - The application is feature-complete for core workflows but not yet deployed to production. No active users.

---

## Feature Status Overview

| Area               | Status   | Notes                                                   |
| ------------------ | -------- | ------------------------------------------------------- |
| Authentication     | Complete | Better-Auth with Google OAuth, 2FA, admin impersonation |
| Organizations      | Complete | Multi-tenant org model with roles (owner/admin/member)  |
| Projects           | Complete | Org-scoped project management with member invitations   |
| Checklists         | Complete | AMSTAR2, ROBINS-I, ROB2 fully implemented               |
| PDF Handling       | Complete | Upload, viewing, Google Drive import, caching           |
| Yjs Sync           | Complete | ProjectDoc Durable Object with WebSocket sync           |
| Reconciliation     | Complete | Multi-reviewer comparison workflow                      |
| Presence/Awareness | Complete | User online status via Yjs awareness protocol           |
| Billing            | Complete | Stripe subscriptions, trials, single-project grants     |
| Admin Panel        | Complete | User/org management, impersonation, billing tools       |
| Local Mode         | Complete | Offline checklist completion without account            |

---

## System Components

### Frontend (packages/web)

| Component         | Status   | Notes                                                             |
| ----------------- | -------- | ----------------------------------------------------------------- |
| Auth UI           | Complete | Login, signup, OAuth, 2FA setup, sessions                         |
| Organization UI   | Complete | Org settings, members, roles, invitations                         |
| Project UI        | Complete | Project tabs (Overview, All Studies, To-Do, Reconcile, Completed) |
| Checklist UI      | Complete | AMSTAR2, ROBINS-I, ROB2 with scoring                              |
| PDF Viewer        | Complete | Embedded viewer with split-screen layout                          |
| Study Management  | Complete | Add studies, manage PDFs, assign reviewers                        |
| Reconciliation UI | Complete | Side-by-side comparison views                                     |
| Dashboard         | Complete | Project overview, quick actions                                   |
| Settings          | Complete | Profile, security, billing, notifications, Google Drive           |
| Admin Dashboard   | Complete | Users, orgs, billing, storage, database viewer                    |

### Backend (packages/workers)

| Component            | Status   | Notes                                   |
| -------------------- | -------- | --------------------------------------- |
| Auth Routes          | Complete | Better-Auth with 2FA, admin plugin      |
| Org Routes           | Complete | Full CRUD, membership, invitations      |
| Project Routes       | Complete | Org-scoped operations, quotas           |
| Member Routes        | Complete | Project membership management           |
| Invitation Routes    | Complete | Org and project invitations             |
| PDF Routes           | Complete | R2 storage, Google Drive proxy          |
| Billing Routes       | Complete | Stripe subscriptions, webhooks, portal  |
| Admin Routes         | Complete | User/org management, impersonation      |
| Contact Routes       | Complete | Rate-limited contact form               |
| Account Merge Routes | Complete | OAuth account linking                   |
| ProjectDoc DO        | Complete | Yjs sync with WebSocket connections     |
| UserSession DO       | Complete | Session management                      |
| Email Queue          | Complete | Cloudflare Queue with Postmark delivery |

### Database Schema

| Table              | Purpose                                  |
| ------------------ | ---------------------------------------- |
| user               | User accounts with 2FA, banning support  |
| organization       | Multi-tenant organizations               |
| member             | Org membership (owner/admin/member)      |
| invitation         | Org invitations                          |
| session            | Auth sessions with impersonation support |
| account            | OAuth provider accounts                  |
| verification       | Email verification tokens                |
| twoFactor          | 2FA secrets and backup codes             |
| projects           | Org-scoped research projects             |
| projectMembers     | Project membership                       |
| projectInvitations | Project invitations with tokens          |
| mediaFiles         | PDF metadata (R2 storage)                |
| subscription       | Stripe subscriptions per org             |
| orgAccessGrants    | Trial and single-project grants          |
| stripeEventLedger  | Webhook observability and auditing       |

### Shared Packages

| Package         | Status   | Notes                         |
| --------------- | -------- | ----------------------------- |
| @corates/ui     | Complete | Ark UI wrappers (re-exports)  |
| @corates/shared | Complete | Error types, plan definitions |
| @corates/mcp    | Complete | Development MCP tools         |

---

## Infrastructure

| System             | Status   | Notes                               |
| ------------------ | -------- | ----------------------------------- |
| Cloudflare Workers | Complete | Hono with OpenAPI support           |
| Cloudflare D1      | Complete | SQLite database with Drizzle ORM    |
| Cloudflare R2      | Complete | PDF storage                         |
| Durable Objects    | Complete | ProjectDoc, UserSession             |
| Email Queue        | Complete | Cloudflare Queue + Postmark         |
| GitHub Actions     | Partial  | Prettier check only                 |

---

## Checklist Support

| Checklist | Status   | Notes                                              |
| --------- | -------- | -------------------------------------------------- |
| AMSTAR2   | Complete | Systematic review quality assessment (16 items)    |
| ROBINS-I  | Complete | Risk of bias in non-randomized studies (7 domains) |
| ROB2      | Complete | Risk of bias in randomized trials (5 domains)      |

Future planned: ROBINS-E, GRADE

---

## Billing Model

| Feature            | Status   | Notes                                |
| ------------------ | -------- | ------------------------------------ |
| Free Tier          | Complete | Limited projects, basic features     |
| Paid Subscriptions | Complete | Pro, Team, Enterprise tiers          |
| Trial Grants       | Complete | Time-limited full access             |
| Single-Project     | Complete | One-time purchase access             |
| Stripe Portal      | Complete | Self-service subscription management |
| Webhook Ledger     | Complete | Full audit trail of Stripe events    |

---

## Plans Status

| Plan               | Status      | Location                                                             |
| ------------------ | ----------- | -------------------------------------------------------------------- |
| Frontend Testing   | In Progress | [frontend-testing-plan.md](plans/frontend-testing-plan.md)           |
| Org Billing        | Complete    | [org-billing-implementation.md](plans/org-billing-implementation.md) |
| Presence/Awareness | Complete    | [presence.md](plans/presence.md)                                     |
| Yjs Awareness      | Complete    | [yjs-awareness.md](plans/yjs-awareness.md)                           |
| Pricing Model      | Draft       | [pricing-model.md](plans/pricing-model.md)                           |

---

## Test Coverage

### Backend (packages/workers)

| Area              | Coverage | Tests                                     |
| ----------------- | -------- | ----------------------------------------- |
| Org routes        | Good     | orgs-management.test.js, org-auth.test.js |
| Project routes    | Good     | projects.test.js                          |
| Member routes     | Good     | members.test.js                           |
| Invitation routes | Good     | project-invitations.test.js               |
| User routes       | Good     | users.test.js                             |
| Avatar routes     | Good     | avatars.test.js                           |
| PDF routes        | Good     | pdfs.test.js, google-drive.test.js        |
| Contact routes    | Good     | contact.test.js                           |
| Database routes   | Good     | database.test.js                          |
| Email routes      | Good     | email.test.js                             |
| Account merge     | Good     | account-merge.test.js                     |
| Billing routes    | Partial  | Tests in billing/**tests**/               |
| Admin routes      | Partial  | Tests in admin/**tests**/                 |

### Frontend (packages/web)

| Area          | Coverage | Notes                             |
| ------------- | -------- | --------------------------------- |
| Primitives    | Partial  | useProject, useOrgs have tests    |
| Components    | Sparse   | Only ErrorBoundary.test.jsx       |
| Lib utilities | Partial  | checklist-domain, pdfUtils tested |
| Checklists    | Partial  | AMSTAR2, ROBINS-I have tests      |

---

## Known Issues

### Technical Debt

| Item                   | Priority | Notes                                          |
| ---------------------- | -------- | ---------------------------------------------- |
| Frontend test coverage | High     | Most components lack tests                     |
| Error helper migration | Low      | 2 uses of raw `new Error()` in project-sync.ts |
| Stripe price IDs       | Medium   | Placeholder values need real IDs               |

---

## Development Notes

- No production users yet
- Minimal TODOs in codebase (1 in contact.jsx for FAQ section)
- Backend routes use OpenAPIHono with Zod validation
- All database access through Drizzle ORM
- Error handling uses @corates/shared error helpers

---

## Next Up

### Before Production

1. Configure real Stripe price IDs
2. Expand frontend test coverage
3. Production deployment setup

### Future Features

1. Additional checklist types (ROBINS-E, GRADE)
2. Export functionality (PDF reports)
3. Enhanced analytics dashboard
