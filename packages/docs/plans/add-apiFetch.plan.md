# Plan: Add `apiFetch` wrapper (no ky / ofetch)

**Date:** January 6, 2026

## Goal

Introduce a small, opinionated `apiFetch` helper for app-level HTTP requests that:

- Provides sensible defaults (`API_BASE`, `credentials: 'include'`, JSON headers)
- Auto-stringifies JSON bodies and passthrough for `FormData`/`Blob`
- Auto-parses JSON responses (with raw response option)
- Integrates with `handleFetchError` and supports a `toastMessage` option
- Supports `signal` for aborts and optional retry/backoff (opt-in)

This is explicitly _not_ a migration to `ky` or `ofetch` — we keep no new external dependency.

## Scope

- Implement `packages/web/src/lib/apiFetch.js` (or `.ts` if preferred)
- Unit tests under `packages/web/src/lib/__tests__/apiFetch.test.js`
- Migrate a small set of high-value callers (stores and `packages/web/src/api/*`) as proof-of-concept
- Update docs and agent rule to prefer `apiFetch` for app API calls

## Plan (ordered)

1. Create file `packages/web/src/lib/apiFetch.js` with a minimal, well-tested API:
   - `apiFetch(path, { method, body, headers, toastMessage, retry, signal, raw })`
   - Returns parsed JSON by default; if `raw: true` returns `Response`
   - Calls `handleFetchError(fetch(...), { showToast: false })` and uses `toastMessage` to show UI toast on error

2. Implement features:
   - `API_BASE` prefixing and `credentials: 'include'`
   - JSON stringify when `body` is plain object; passthrough for `FormData`/`Blob`/`string`
   - `signal` passthrough
   - No retry logic needed

3. Tests:
   - Success: returns parsed JSON
   - Error: `handleFetchError` integration and toast behavior
   - FormData passthrough
   - Abort via `signal`
   - Retry behavior when enabled

4. Migration (incremental):
   - Replace calls in `packages/web/src/api/*` and `packages/web/src/stores/*` first
   - Run tests after each batch; keep PRs small
   - Leave raw `fetch` in streaming, websocket, and presigned-upload flows

5. Docs & Rule Update:
   - Add short usage snippet to `packages/docs/guides` (or `packages/web/README.md`)
   - Update `.cursor/rules/error-handling.mdc` to show `apiFetch` pattern

6. Rollout:
   - Open PR with feature branch `feature/apiFetch`
   - CI: run `pnpm test` and `pnpm lint`
   - Post-merge: watch errors, rollback if billing/auth regressions occur

## Minimal Example (usage)

```javascript
import { apiFetch } from '@/lib/apiFetch.js';

// default: JSON body, parses JSON response
const project = await apiFetch('/api/projects', { method: 'POST', body: { name: 'New' } });

// custom toast on error
const res = await apiFetch('/api/something', { toastMessage: 'Could not load data' });

// passthrough FormData
const fd = new FormData();
fd.append('file', fileInput.files[0]);
await apiFetch('/api/upload', { method: 'POST', body: fd, raw: true });
```

## Rollback Plan

- Revert the PR if failing tests or runtime errors persist
- Re-run migration PRs to revert changes incrementally

## Ownership

- Author: frontend team (owner: `packages/web`)
- Reviewer: backend or auth owner when touching auth-related endpoints

---

Create TODOs tracked in repo-level task list for implementation steps.
