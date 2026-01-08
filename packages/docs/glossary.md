# CoRATES Terminology Glossary

A comprehensive guide to domain terminology, technical concepts, and acronyms used throughout the CoRATES codebase.

## Table of Contents

- [Domain Terminology](#domain-terminology)
- [Technical Concepts](#technical-concepts)
- [Systematic Review Terminology](#systematic-review-terminology)
- [Architecture & Patterns](#architecture--patterns)
- [Billing & Access Control](#billing--access-control)
- [Acronyms](#acronyms)

---

## Domain Terminology

### Organization (Org)

A top-level tenant entity representing a research group, institution, or team. Organizations:

- Own projects and subscriptions
- Have members with role-based access
- Are billed as a unit (org-scoped billing)
- Can have one active subscription or access grant

**Related:** [src/db/schema.js:orgs](../workers/src/db/schema.js), Billing Model

### Project

A systematic review project containing studies, checklists, and PDFs. Projects:

- Belong to a single organization
- Have their own member list (project-level access)
- Use Yjs CRDT for real-time collaboration
- Store data in a Durable Object (ProjectDoc)
- Have a unique `projectId` (UUID)

**Related:** [ProjectDoc.js](../workers/src/durable-objects/ProjectDoc.js), Yjs Sync

### Study

A publication or research study being evaluated in a systematic review. Studies:

- Belong to a project
- Can have multiple checklists (AMSTAR2, ROBINS-I, etc.)
- Can have associated PDF files stored in R2
- Track metadata like title, authors, year, journal

**Related:** Studies are stored in the Yjs document as an array

### Checklist

A structured assessment tool (AMSTAR2, ROBINS-I, etc.) used to evaluate a study. Checklists:

- Follow a specific schema (questions, domains, scoring)
- Support collaborative completion with Yjs
- Can be reconciled between multiple reviewers
- Track completion status and assessor

**Related:** Local checklists (offline) vs. project checklists (synced)

### Reconciliation

The process of resolving disagreements between multiple reviewers' checklist assessments. Reconciliation:

- Compares two completed checklists item-by-item
- Shows agreements, disagreements, and missing responses
- Calculates inter-rater reliability (Cohen's kappa, percent agreement)
- Creates a final reconciled checklist

**Related:** [ReconciliationWrapper.jsx](../web/src/components/project/reconcile-tab/amstar2-reconcile/ReconciliationWrapper.jsx)

---

## Technical Concepts

### Yjs (Y.js)

A CRDT (Conflict-free Replicated Data Type) library for real-time collaborative editing. In CoRATES:

- **ydoc** - The Yjs document containing shared state
- **Y.Array** - Shared array (e.g., `studies`, `checklists`)
- **Y.Map** - Shared key-value map (e.g., `metadata`)
- **provider** - WebSocket connection to sync ydoc with backend
- **awareness** - User presence protocol (who's online, cursor positions)

**Related:** [Yjs Sync Guide](guides/yjs-sync.md), [ProjectDoc.js](../workers/src/durable-objects/ProjectDoc.js)

### Durable Objects (DO)

Cloudflare's distributed computing primitive providing:

- Single-threaded, stateful compute (like an actor)
- In-memory state with optional persistent storage
- WebSocket support for real-time connections
- Used for ProjectDoc (Yjs sync) and UserSession (presence)

**Related:** [durable-objects.mdc](../../.cursor/rules/durable-objects.mdc)

### IndexedDB

Browser-based persistent storage used for offline-first capabilities:

- **corates** - Unified Dexie database containing:
  - `projects` - Y.Doc persistence (via y-dexie)
  - `pdfs` - PDF file cache with LRU eviction
  - `avatars` - User avatar cache
  - `formStates` - Form auto-save for OAuth redirects
  - `queryCache` - TanStack Query persistence
  - `localChecklists` - Offline practice checklists
  - `localChecklistPdfs` - PDFs for local checklists
  - `ops` - Operation queue for offline mutations (future)
- **y-indexeddb-{projectId}** - Per-project Yjs document persistence (legacy, kept for y-indexeddb)

**Related:** [Offline/Local-First Audit](audits/offline-local-first-audit-2026-01.md), [db.js](../web/src/primitives/db.js)

### TanStack Query (React Query)

Data fetching and caching library used in CoRATES for:

- Server state management (projects, orgs, subscriptions)
- Optimistic updates
- Cache invalidation via query keys
- Offline persistence with IndexedDB persister

**Related:** [queryClient.js](../web/src/lib/queryClient.js), [queryKeys.js](../web/src/lib/queryKeys.js)

### Better Auth

Authentication library (v1.4.10) providing:

- Email/password authentication
- Social OAuth (Google)
- Magic link email authentication
- Organization membership
- Session management with httpOnly cookies

**Related:** [better-auth-store.js](../web/src/api/better-auth-store.js), [auth/config.js](../workers/src/auth/config.js)

### Service Worker

Browser background script for offline capabilities (currently disabled):

- Caches static assets
- Intercepts network requests
- Enables offline UI access
- Uses network-first strategy

**Related:** Currently commented out in landing package

### Drizzle ORM

TypeScript ORM used for database access:

- Type-safe queries
- Schema definition in TypeScript
- Migrations support
- Used with Cloudflare D1 (SQLite)

**Related:** [db/schema.js](../workers/src/db/schema.js)

### Hono.js

Lightweight web framework for Cloudflare Workers:

- Express-like API
- Middleware support
- Type-safe routing with context
- Used for all backend API routes

**Related:** [index.js](../workers/src/index.js)

---

## Systematic Review Terminology

### AMSTAR2

"A MeaSurement Tool to Assess systematic Reviews 2" - A 16-item critical appraisal tool for systematic reviews of healthcare interventions.

### ROBINS-I

"Risk Of Bias In Non-randomized Studies - of Interventions" - A tool to assess risk of bias in non-randomized studies. Has 7 domains with signaling questions.

### Cohen's Kappa

Inter-rater reliability statistic measuring agreement between two reviewers beyond chance. Range: -1 to 1 (>0.8 = excellent agreement).

**Related:** [inter-rater-reliability.js](../web/src/lib/inter-rater-reliability.js)

### Systematic Review

A research methodology that comprehensively identifies, appraises, and synthesizes all relevant studies on a specific research question.

### Meta-Analysis

Statistical technique combining results from multiple studies to produce a single estimate of effect.

---

## Architecture & Patterns

### Domain Errors

Centralized error system from `@corates/shared`:

- Type-safe error codes (AUTH_ERRORS, PROJECT_ERRORS, etc.)
- Consistent error structure with `code`, `message`, `statusCode`, `details`
- Normalization for transport errors vs. business logic errors

**Related:** [@corates/shared/errors](../shared/src/errors/), [error-handling.mdc](../../.cursor/rules/error-handling.mdc)

### Middleware Stack

Composable request processing pipeline:

```javascript
route.post(
  '/',
  requireAuth, // Authentication
  requireOrgMembership(), // Organization access
  requireEntitlement('project.create'), // Feature flag
  requireQuota('projects.max', fn, 1), // Quota check
  validateRequest(schema), // Input validation
  handler, // Business logic
);
```

**Related:** [middleware/](../workers/src/middleware/)

### Query Key Factory

Centralized function for generating TanStack Query cache keys:

- Prevents cache invalidation bugs from inconsistent keys
- Type-safe with TypeScript
- Namespaced by domain (projects, orgs, admin, etc.)

**Related:** [queryKeys.js](../web/src/lib/queryKeys.js)

### Optimistic Updates

UI pattern where changes appear immediately before server confirmation:

- Update local cache optimistically
- Roll back on server error
- Prevents UI lag on slow networks

**Related:** TanStack Query mutations with `onMutate`, `onError`, `onSettled`

### Local-First Architecture

Design pattern prioritizing local data and offline functionality:

- IndexedDB as primary data store
- Sync to server when online
- Conflict resolution with CRDTs (Yjs)
- Works offline with cached data

**Related:** [Offline/Local-First Audit](audits/offline-local-first-audit-2026-01.md)

### Headless Components

UI components that provide behavior/state without styling:

- Ark UI primitives provide accessibility and state
- Tailwind CSS for styling
- Full customization control

**Related:** [@corates/ui](../ui/)

---

## Billing & Access Control

### Plan

A subscription tier (free, starter_team, team, unlimited_team) defining:

- **Entitlements** - Boolean feature flags (e.g., `project.create`)
- **Quotas** - Numeric limits (e.g., `projects.max: 10`)
- **Pricing** - Monthly/yearly cost in cents

**Related:** [@corates/shared/plans](../shared/src/plans/), [PLANS configuration](../shared/src/plans/plans.ts)

### Access Grant

Time-limited access upgrade (trial, single_project) that:

- Temporarily overrides the base plan
- Has an expiration date
- Is org-scoped (one per organization)
- Stored in `orgAccessGrants` table

**Related:** Billing resolver logic in workers package

### Subscription

Stripe subscription providing ongoing access:

- Org-scoped (one per organization)
- Has a `planId` (starter_team, team, unlimited_team)
- Synced via Stripe webhooks
- Stored in `orgSubscriptions` table

**Related:** [routes/billing/](../workers/src/routes/billing/)

### Entitlement

Boolean capability check (e.g., "can create projects"):

```javascript
if (!plan.entitlements['project.create']) {
  return forbidden('Plan does not allow project creation');
}
```

**Related:** requireEntitlement middleware

### Quota

Numeric limit check (e.g., "max 10 projects"):

```javascript
const maxProjects = plan.quotas['projects.max'];
if (!isUnlimitedQuota(maxProjects) && currentCount >= maxProjects) {
  return quotaExceeded();
}
```

**Related:** requireQuota middleware, isUnlimitedQuota helper

### Webhook Ledger

Idempotency tracking for Stripe webhooks:

- Stores `payloadHash` and `stripeEventId`
- Prevents duplicate processing
- Two-phase verification pattern (verify signature, then check ledger)

**Related:** [routes/billing/index.js](../workers/src/routes/billing/index.js)

### Billing Resolver

Logic that determines effective plan from multiple sources:

```
1. Active subscription (highest priority)
2. Active access grant (fallback)
3. Free plan (default)
```

**Related:** billingResolver.js

---

## Acronyms

### Technical

- **API** - Application Programming Interface
- **CRDT** - Conflict-free Replicated Data Type
- **CSRF** - Cross-Site Request Forgery
- **CORS** - Cross-Origin Resource Sharing
- **DO** - Durable Object (Cloudflare)
- **D1** - Cloudflare's SQLite database service
- **HTTP** - Hypertext Transfer Protocol
- **JWT** - JSON Web Token
- **ORM** - Object-Relational Mapping
- **PDF** - Portable Document Format
- **R2** - Cloudflare's object storage (S3-compatible)
- **REST** - Representational State Transfer
- **SPA** - Single Page Application
- **SSE** - Server-Sent Events
- **UUID** - Universally Unique Identifier
- **WebSocket** - Full-duplex communication protocol

### Systematic Review

- **AMSTAR2** - A MeaSurement Tool to Assess systematic Reviews 2
- **PICO** - Population, Intervention, Comparison, Outcome
- **PRISMA** - Preferred Reporting Items for Systematic Reviews and Meta-Analyses
- **RCT** - Randomized Controlled Trial
- **ROBINS-I** - Risk Of Bias In Non-randomized Studies - of Interventions

### Business/Domain

- **Org** - Organization (tenant entity)
- **CoRATES** - Collaborative Risk Assessment Tool for Evidence Synthesis

---

## Code Location References

For more details on any concept, see:

- **Backend:** [packages/workers/README.md](../workers/README.md)
- **Frontend:** [packages/web/README.md](../web/README.md)
- **Shared:** [packages/shared/README.md](../shared/README.md)
- **UI Components:** [packages/ui/README.md](../ui/README.md)
- **Cursor Rules:** [.cursor/rules/](../../.cursor/rules/)
- **Guides:** [guides/](guides/)
- **Audits:** [audits/](audits/)

---

## Contributing to This Glossary

When adding new domain concepts or technical terms:

1. Add entry to appropriate section
2. Include brief definition (1-2 sentences)
3. Add "Related:" links to relevant code/docs
4. Update Table of Contents if adding new section
5. Use consistent formatting (bold for term, italics for emphasis)
