# Architecture Deepening Candidates

Generated 2026-03-17. Analysis of module boundaries where consolidation would improve testability, reduce coupling, and hide complexity behind smaller interfaces.

---

## 1. Reconciliation Engine (Frontend)

- **Cluster**: `AMSTAR2Reconciliation.tsx` (738 lines), `ROB2Reconciliation.tsx` (765 lines), `RobinsIReconciliation.tsx` (738 lines), plus comparison helpers, presence hook, navigation state
- **Why they're coupled**: All three implement the same concept -- multi-page reconciliation of two reviewers' checklist answers. They share page navigation, comparison display, answer resolution, and presence awareness. The pattern is duplicated 3x rather than parameterized.
- **Dependency category**: Intra-module duplication. These files share types from `checklist-registry`, call into `projectActionsStore.reconciliation`, and use `useReconciliationPresence`. The real complexity lives in how comparison results are rendered and resolved.
- **Test impact**: Currently zero tests for reconciliation. A unified module with a clean boundary could be tested at that boundary (given checklist type + two answer sets, produce reconciliation UI) instead of needing separate tests for 3 near-identical implementations.

---

## 2. Project Sync System (Frontend)

- **Cluster**: `useProject/` (8 modules, 2341 lines), `projectActionsStore/` (7 sub-modules), `projectStore.ts`, `ProjectContext.tsx`, `sync.js`, `connection.js`
- **Why they're coupled**: Understanding "how project data flows" requires bouncing across all these files. The useProject hook manages connections, sync.js pushes Yjs state into the Zustand store, projectActionsStore dispatches writes back to Yjs, and ProjectContext provides identity. Five files share ownership of the "project data" concept.
- **Dependency category**: Shared-state coupling. Multiple modules read/write the same Yjs document and Zustand store, with implicit ordering (connection must exist before operations, sync must run before store reads are valid).
- **Test impact**: Currently untestable -- requires Yjs connections, ProjectView lifecycle setup, and Durable Object backends. A deep module hiding the sync protocol behind a "project operations" interface would allow boundary testing with a mock document.

---

## 3. Database Access Layer (Backend)

- **Cluster**: Raw Drizzle queries across 68 route files, `commands/`, `middleware/`, `policies/`, `durable-objects/ProjectDoc.ts`
- **Why they're coupled**: The same queries (e.g., "get org membership," "get project with members") are written inline 5-10 times across different files. Schema changes require hunting through every file that queries that table. The ProjectDoc Durable Object even queries D1 directly for auth validation.
- **Dependency category**: Cross-boundary dependency (data access spread across application, middleware, and infrastructure layers). No abstraction between "what data do I need" and "how do I query it."
- **Test impact**: Route tests currently set up full D1 databases. A repository layer would let command and policy tests use a simple mock/stub, and would make query optimization visible in one place.

---

## 4. Billing Resolution (Backend)

- **Cluster**: `billingResolver.ts`, `requireEntitlement.ts`, `requireQuota.ts`, `subscription` table, `orgAccessGrants` table, quota transaction logic in commands
- **Why they're coupled**: Both `requireEntitlement` and `requireQuota` middleware independently call `resolveOrgAccess()`, hitting the database twice per request for the same data. Quota transaction rollback is a custom pattern in commands that duplicates billing state logic. The "what can this org do" question is answered in 3 different places.
- **Dependency category**: Shared-state coupling (billing state queried redundantly). The interface to billing is already small (resolve once, check entitlements/quotas), but the implementation leaks into multiple middleware and command files.
- **Test impact**: Currently tested indirectly through route tests. A single `OrgBilling` module resolved once per request and injected into context would make billing logic testable in isolation and eliminate redundant DB queries.

---

## 5. PDF Handling Pipeline (Frontend)

- **Cluster**: `pdf-api.ts`, `useProject/pdfs.js`, `ChecklistYjsWrapper.tsx`, `pdfPreviewStore.ts`, `pdfCache.js`, `components/pdf/embedpdf/`
- **Why they're coupled**: "Which PDF is the user looking at" has multiple sources of truth across 6 files. Upload, cache, sync, preview, and download are each owned by a different module. Understanding the PDF lifecycle requires reading all 6.
- **Dependency category**: Distributed ownership of a single concept. The PDF identity (URL, blob, cache key) passes through R2 storage, Yjs metadata, IndexedDB cache, and React state with no single module owning the lifecycle.
- **Test impact**: Currently untested. A deep "PDF manager" module that owns the full lifecycle (upload -> cache -> sync -> display) could be tested at its boundary without needing R2 or Yjs connections.

---

## 6. Middleware Composition (Backend)

- **Cluster**: `runMiddleware()` pattern in 30+ route handlers, `requireAuth`, `requireOrgMembership`, `requireProjectAccess`, `requireEntitlement`, `requireQuota`, `requireOrgWriteAccess`
- **Why they're coupled**: Routes manually chain 2-5 middleware calls with boilerplate `if (response) return response` checks. The ordering is implicit and error-prone. Common combinations (auth + org membership + write access) are repeated verbatim across many routes.
- **Dependency category**: Interface complexity. Each middleware has the same shape but composition requires manual glue code. The interface (call middleware, check response, continue) is nearly as complex as the implementation.
- **Test impact**: Middleware are individually tested but their compositions are not. A composable middleware stack would let you test "this route requires admin + write access" as a single declaration rather than verifying 6 lines of boilerplate per route.
