Dev seed dataset (DB + Durable Objects + PDFs)
Goals
Provide a repeatable, deterministic seed that creates a realistic admin dataset.
Seed D1 + ProjectDoc Durable Objects (via Yjs snapshot) and PDFs in R2.
Ensure 1 user = 1 personal org (counts aligned).
Ensure seeded users can log in with known email/password.
Keep dev code out of production runtime paths by using env-gated dynamic imports.
Key discoveries from the codebase
ProjectDoc persists full Yjs state in DO storage under yjs-state using Y.encodeStateAsUpdate on every update.
Worker already has internal DO sync utilities via X-Internal-Request (see packages/workers/src/lib/project-sync.js) and project-scoped DO addressing (packages/workers/src/lib/project-doc-id.js).
Better Auth is configured with email/password and requires email verification (packages/workers/src/auth/config.js), and admin is determined by user.role === 'admin' (packages/workers/src/auth/admin.js).
Workers cannot read from local filesystem at runtime, so to use your local PDF fixtures we should upload them from a Node script (reading packages/workers/seed/pdfs/) and send them to the dev seed endpoint.
Proposed architecture

1. Dev-only route surface (no prod import)
   Add a /api/dev/seed route that is only loaded in dev via a runtime env check + dynamic import.
   In production, the handler should return 404 before importing any dev code.
   Implementation pattern (mirrors existing /docs dynamic import in packages/workers/src/index.js):

Add a lightweight /api/dev/\* handler in packages/workers/src/index.js that:
If c.env.ENVIRONMENT === 'production': return 404.
Else: await import('./routes/dev/index.js') and delegate. 2) Seed runner (Node) using Faker + PDF upload
Create a Node script (e.g. packages/workers/scripts/seed-dev.mjs) that:
Uses @faker-js/faker to generate names/emails and scenario variation.
Reads local PDF fixtures from packages/workers/seed/pdfs/ (gitignored).
Calls /api/dev/seed with a JSON payload for DB/Yjs structure.
Uploads PDFs by sending multipart/form-data or raw application/pdf bodies to a companion dev endpoint (or same endpoint) so the worker can R2.put(...). 3) Reset-all behavior (your choice)
The seed endpoint will support reset-all:
D1: delete from all tables relevant to auth/orgs/projects/billing/media in a safe order.
R2: delete objects under projects/{projectId}/... (same key format used by packages/workers/src/routes/orgs/pdfs.js).
ProjectDoc DO: add an internal-only DO endpoint to clear yjs-state (or overwrite with an empty doc) for seeded projects. 4) Creating real login-capable users
Because Better Auth uses credential password hashing and verification internally, the seed route will:

Create each user via Better Auth server API (auth.api.signUpEmail) so the account/password hash is correct.
Mark the user as verified in DB (user.emailVerified = true) to satisfy requireEmailVerification.
Trigger a sign-in (auth.api.signInEmail or auth.handler to the sign-in endpoint) to create a session and allow existing “bootstrap personal org” behavior to run.
Set one user to role='admin' so the admin dashboard features are available. 5) Subscriptions/grants and project scenarios
Seed a small dataset with aligned counts, e.g. 12 users + 12 orgs:

Mix of org billing states:
active subscription (team)
trialing subscription
past_due (within grace)
canceled/expired -> read-only grant
free tier
Projects per org: 0–3, with varied membership (owner-only, 2–4 members, invited-but-not-accepted). 6) Seeding Yjs snapshots into ProjectDoc
Add an internal-only ProjectDoc endpoint to accept a full snapshot:

POST /seed-state (requires X-Internal-Request: true)
Body: { yjsState: number[] } (bytes)
DO behavior:
storage.put('yjs-state', yjsState)
If doc already initialized, Y.applyUpdate(doc, new Uint8Array(yjsState))
The seed route (or Node script) will generate deterministic Y.Doc snapshots containing:

meta map
members map (mirrors D1 project membership, plus display/email)
reviews map with studies in different stages:
empty study (no checklists)
study with 1–2 checklists partially answered
study with multiple checklists completed
study with pdfs map populated
This matches the structure used by ProjectDoc (packages/workers/src/durable-objects/ProjectDoc.js).

7. Seeding PDFs
   PDFs are stored in R2 with keys:
   projects/{projectId}/studies/{studyId}/{fileName}
   (from packages/workers/src/routes/orgs/pdfs.js)
   The Node script uploads PDF bytes to the dev endpoint, which writes them to R2.
   The Yjs snapshot includes PDF metadata consistent with ProjectDoc.handleSyncPdf (fileName, key, size, uploadedBy, uploadedAt).
   Files to add/change
   packages/workers/src/index.js
   Add env-gated /api/dev/\* dispatcher with dynamic import.
   packages/workers/src/routes/dev/index.js
   Dev-only router (mounted via dynamic import).
   packages/workers/src/routes/dev/seed.js
   Implements reset-all + DB seeding + DO snapshot seeding + R2 upload endpoints.
   packages/workers/src/durable-objects/ProjectDoc.js
   Add internal-only /seed-state and /reset-state handlers.
   packages/workers/scripts/seed-dev.mjs
   Node seed runner (faker + reading local PDFs + calling endpoints).
   packages/workers/seed/pdfs/.gitignore and root .gitignore
   Ensure PDFs are not committed.
   packages/workers/package.json
   Add seed:dev script and add @faker-js/faker as a dev dependency.
   Data flow diagram
   POST /api/dev/seed
   Upload PDFs
   BetterAuth.signUpEmail
   Update user.emailVerified
   SignIn to trigger personalOrg
   Insert projects,members,subscriptions,grants
   POST X-Internal-Request /sync
   POST X-Internal-Request /seed-state
   R2.put projects/...
   Yjs snapshot includes pdf metadata
   seed-dev.mjs
   devSeedRoute
   devPdfUpload
   auth
   D1
   ProjectDoc DO
   R2 PDF_BUCKET

Acceptance criteria
Running pnpm --filter workers seed:dev resets local dev data and seeds a small, realistic dataset.
You can log in as multiple seeded users with known credentials.
Admin dashboard shows:
Orgs/users/projects present
Varied billing states (subscription/grant/free)
