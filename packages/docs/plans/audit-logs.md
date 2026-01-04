# Audit logs implementation plan

This is a plan for adding comprehensive audit logging across CoRATES (admin actions, auth events, billing events, project lifecycle events, and data events like PDF upload/delete).

## Summary

- Add a new `audit_logs` table in D1 (via Drizzle) keyed by a generated ID and timestamp.
- Add an audit middleware in Workers that:
  - generates a request ID
  - captures IP and user agent
  - exposes a `ctx.audit.log(...)` helper
- Write audit events asynchronously (use `waitUntil`) so logging does not block responses.
- Expose an admin API to query and export audit logs.
- Add retention cleanup via a cron trigger.

## Canonical source

The full detailed plan (including schema, event catalog, and implementation phases) currently lives at:

- `docs/plans/audit-logs.plan.md`
