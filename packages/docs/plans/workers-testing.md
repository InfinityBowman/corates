P1: Org management APIs (currently high-risk, low coverage)
Better Auth org API delegation layer (src/routes/orgs/index.js)
Add tests around: create/update/delete org, list members, add/remove member, update role, set-active.
Key cases: slug taken, self-removal vs admin removal, last owner protection, and correct status codes.
P1: Project invitation flow (complex, easy to break)
Org project invitations (src/routes/orgs/invitations.js)
Add tests for: create vs resend invitation, already accepted, expiration, acceptance path that ensures org membership then project membership, and DO sync side effects (syncMemberToDO).
Also test the “email + magic link generation” path but keep it mocked (assert “attempted”, not real delivery).
P1: Admin operational endpoints you’ll rely on during incidents
Billing observability reconciliation (src/routes/admin/billing-observability.js)
Add tests for: stuck-state detection thresholds, “checkout completed but no subscription”, repeated failures, processing lag, and optional checkStripe=true branch with Stripe mocked.
Admin billing/storage/orgs routes (src/routes/admin/billing.js, src/routes/admin/storage.js, src/routes/admin/orgs.js)
Add at least smoke + a couple sharp-edge tests each (pagination, validation, deletes, R2 interactions).
P2: WebSocket upgrade + DO routing correctness
ProjectDoc WS routing (src/index.js handleProjectDoc at /api/project-doc/:projectId/\*)
Add tests that ensure 101 upgrade responses are passed through unwrapped, and non-WS responses remain normal.
If you care about authz at the WS boundary, add one test that proves a removed org member cannot keep syncing (this is often a real-world footgun).

Notes for testing:
If some tests fail initially because the current behavior is wrong, that’s acceptable; we’ll either:
fix the implementation in the same follow-up PR, or
keep the failing tests as a tracked “known incorrect” until fixes land.
