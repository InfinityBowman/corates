# Testing Guide

CoRATES uses Vitest for unit and server tests, and Playwright for end-to-end tests. This guide covers the three test layers, when to use each, and the conventions they follow.

## Test layers

| Layer   | Runs in                             | Config                     | File pattern               | Purpose                                                    |
| ------- | ----------------------------------- | -------------------------- | -------------------------- | ---------------------------------------------------------- |
| Unit    | jsdom                               | `vitest.config.ts`         | `*.test.ts[x]`             | Pure functions, hooks, Zustand stores, React components    |
| Server  | Workers pool                        | `vitest.server.config.ts`  | `*.server.test.ts`         | TanStack Start route handlers against a real D1 + bindings |
| Browser | real browser (vitest-browser-react) | `vitest.browser.config.ts` | `*.browser.test.tsx`       | Component tests needing real layout/IO                     |
| E2E     | Playwright                          | `playwright.config.ts`     | `*.spec.ts` (under `e2e/`) | Full user flows against a running dev server               |

The unit config explicitly **excludes** `*.server.test.ts` and `*.browser.test.tsx`, so all three can coexist without cross-contamination.

## Commands

```bash
# Unit + server (full test suite)
pnpm --filter web test

# Unit only, in watch mode
pnpm --filter web test:watch

# Server only (spins up wrangler test database first)
pnpm --filter web test:server

# E2E (ask the user to confirm dev server is running first)
pnpm --filter web test:e2e
```

## Philosophy

Tests validate **intended behavior**, not implementation details. Prefer asserting on:

1. Function / component names and their semantic meaning.
2. JSDoc comments and inline documentation of intent.
3. Domain conventions (AMSTAR-2 methodology, systematic review practices).
4. Expected UX patterns.

Use the AAA structure: **Arrange**, **Act**, **Assert**. A test that names its phases is usually a test that knows what it's testing.

When you discover a bug while writing a test, write the test for the _intended_ behavior and add a `// BUG:` comment explaining the divergence. The failing test is the bug report.

## Unit tests (jsdom)

### Pure functions

Straightforward input / output assertions.

```ts
import { describe, it, expect } from 'vitest';
import { formatDate } from '../dateUtils';

describe('formatDate', () => {
  it('formats ISO date strings', () => {
    expect(formatDate('2025-01-15T10:30:00Z')).toBe('1/15/2025');
  });

  it('returns empty string for invalid input', () => {
    expect(formatDate(null)).toBe('');
  });
});
```

### Zustand stores

Reset store state between tests with `setState`, then drive the store via its actions and assert via selectors.

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from '@/stores/projectStore';

beforeEach(() => {
  useProjectStore.setState({ projects: {}, activeProjectId: null, connections: {} });
});

it('setProjectData hydrates a project entry', () => {
  useProjectStore.getState().setProjectData('p1', { studies: [] });
  expect(useProjectStore.getState().projects.p1).toBeDefined();
});
```

### React components

Use `@testing-library/react` with the `@testing-library/jest-dom` matchers.

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MyComponent } from '../MyComponent';

describe('MyComponent', () => {
  it('renders the title', () => {
    render(<MyComponent title='Hello' />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

For components that depend on TanStack Query, wrap with a fresh `QueryClientProvider`. For components that depend on `useAuthStore`, pre-seed the store in `beforeEach` rather than mocking the module.

### Hooks

For hooks with no rendering requirements, use `renderHook` from `@testing-library/react`.

```tsx
import { renderHook } from '@testing-library/react';
import { useDebouncedValue } from '../useDebouncedValue';

it('debounces the value', () => {
  const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 100), {
    initialProps: { v: 'a' },
  });
  // ...
});
```

For hooks that fetch, provide a `QueryClientProvider` wrapper.

### Mocking modules

```ts
import { vi } from 'vitest';

const { getInvoices } = vi.hoisted(() => ({ getInvoices: vi.fn() }));
vi.mock('@/server/functions/billing.functions', () => ({ getInvoices }));
```

Prefer pre-seeding stores and query caches over mocking the modules that consume them -- mocks drift; state snapshots don't.

### Browser APIs

```ts
Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
```

`localStorage`, `indexedDB`, `BroadcastChannel`, and `crypto.subtle` are all available under jsdom.

## Server tests

Server tests live in a `__tests__/` folder next to the code with the `*.server.test.ts` suffix, and run under `vitest.server.config.ts`. They run in the Cloudflare Workers pool, so `env.DB`, R2, Durable Object bindings, and `cloudflare:workers` imports all resolve against a test D1 database prepared by `pnpm db:generate:test`.

Most server code is server functions, so most server tests call the logic in `X.server.ts` directly. HTTP routes are tested by calling their named handlers.

### Server function logic

`X.server.ts` functions take `session` and `db` as parameters, so a test seeds data with the factories in `@/__tests__/server/factories`, builds a session, and calls the function. Guards run for real, so authorization cases are tested the same way.

```ts
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { resetTestDatabase } from '@/__tests__/server/helpers';
import { buildOrg, buildOrgMember, resetCounter } from '@/__tests__/server/factories';
import { updateWorkspaceSettings } from '@/server/functions/workspaces.server';

function sessionFor(user: { id: string; email: string }): Session {
  return { user: { ...user, name: 'Test' }, session: { id: 's', userId: user.id } } as Session;
}

beforeEach(async () => {
  await resetTestDatabase();
  resetCounter();
});

it('refuses settings changes from a member', async () => {
  const { org } = await buildOrg();
  const { user } = await buildOrgMember({ orgId: org.id, role: 'member' });
  await expect(
    updateWorkspaceSettings(sessionFor(user), createDb(env.DB), org.id, { name: 'Mine now' }),
  ).rejects.toThrow();
});
```

Mock `@corates/workers/billing-resolver` when a test needs a particular plan without seeding a subscription.

### HTTP route handlers

Import the route's named handler and call it with a synthesized `Request`. This bypasses TanStack Start's routing and any route middleware, so pass the context the middleware would attach (`{ db, session }`) when the route uses `authMiddleware`.

```ts
import { handleGet } from '../health';

it('returns 200 + healthy when all dependencies respond', async () => {
  const res = await handleGet();
  expect(res.status).toBe(200);
});
```

```ts
import { handlePost } from '../client-logs';

const res = await handlePost({
  request: new Request('http://localhost/api/client-logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entries: [{ level: 'info', message: 'client.example', route: '/' }] }),
  }),
});
```

The test worker (`src/__tests__/server/test-worker.ts`) also mounts the full Start handler, so `SELF.fetch` from `cloudflare:test` can drive a request through routing and middleware end to end when a test needs that.

### Database isolation

Server tests share the test D1. Each test file that mutates data should reset the DB in `beforeEach` via the shared helpers, or scope its assertions to unique IDs. Do not rely on cross-file ordering.

### Mocking external services

Postmark and Stripe are mocked globally in the server setup file to avoid hitting real services or triggering startup failures in the test Worker. Individual tests can override these mocks per-test with `vi.mocked(...).mockReturnValueOnce(...)`.

## Browser tests

`*.browser.test.tsx` files run under `vitest-browser-react` against a real browser (Playwright-controlled). Use these only when jsdom cannot represent the behavior -- real layout measurements, pointer events on shadcn popovers, IntersectionObserver, etc.

## E2E tests

Playwright specs live under `packages/web/e2e/`. They run against a dev server the user starts manually (`pnpm --filter web dev`). Ask the user to confirm the server is running before invoking `test:e2e`.

Prefer e2e coverage on:

- Sign-in / sign-up flows.
- Stripe checkout and subscription state transitions.
- Collaborative editing (two browser contexts against the same project).

Do not use e2e for what a unit or server test can cover. They are the slowest and most brittle layer.

### Harness conventions

- Import `test` and `expect` from `./test`, not `@playwright/test`. The wrapper logs failed requests and uncaught page errors into the test output, so a runner network fault reads as `net::ERR_TIMED_OUT` next to the assertion it broke. `loginAs` does the same for contexts a spec creates itself.
- Call the test API through `testApi()` in `e2e/helpers.ts`. It retries connection failures and Cloudflare 5xx with backoff; every `/api/test/*` route it reaches is idempotent, so a retry after a lost response is safe. Keep new routes that way.
- Every spec must be safe to run twice. Remote runs retry a failed test in a fresh worker, which re-runs `beforeAll` and seeds again while the earlier data is still there. Seed with `uniquePrefix`, guard `afterAll` cleanup with `if (scenario)`, and scope locators on shared seeded names (Alice Reviewer, Regular User) to a row or href rather than the bare text.
- CI runs `scripts/e2e-ci.sh`: a full pass, then one re-run of up to three failed specs after the suite has finished, then a job summary from the JSON reporter output. The first pass's traces land in `test-results-first-pass/` in the artifact when that re-run happened.

### Selectors

E2E runs only after merge, so a copy or layout change that breaks a locator lands on main and blocks the production deploy. The rule that keeps that rare:

- **A `data-testid` for what the test clicks or scopes into.** Dialogs and sheets (`add-studies-sheet`, `mark-complete-dialog`), overflow menus (`study-card-menu`), pickers (`reviewer-picker-1`), list rows a spec must pin to one seeded record (`member-row` and `admin-user-link`, each carrying `data-user-id`), and containers a spec walks (`signalling-question`, `plan-card-<tier>`).
- **A role or text locator for what the test reads.** Headings, toasts, status labels, and button copy a user would see stay as `getByRole` / `getByText`, scoped to a testid container where the same text can appear twice.
- **State comes from ARIA, not classes.** Signalling answer buttons carry `aria-pressed`; use `getByRole('button', { pressed: true })`. `[data-sync-pending]` is the outbox marker. Never read a Tailwind class to detect state.
- **Never a CSS class, XPath, or icon selector.** `.rounded-2xl`, `svg.lucide-*`, and `div.border-b` all break on the next restyle.

Conventions: the attribute is `data-testid`, kebab-case, noun-first (`plan-card-cta`, not `cta-plan-card`), placed on the element the test interacts with rather than a wrapper. Playwright's default `testIdAttribute` already matches, so no config is needed. Add a testid only for an element a spec uses, and never remove one in a refactor without grepping `packages/web/e2e/` for it first. The attribute is the contract.

## Common patterns

### Async

```ts
it('handles async operations', async () => {
  const result = await someAsyncFunction();
  expect(result).toBeDefined();
});
```

### Errors

```ts
it('throws on invalid input', () => {
  expect(() => validateInput(null)).toThrow('Input required');
});

it('rejects with the right error', async () => {
  await expect(asyncFn()).rejects.toThrow('Expected error');
});
```

### DOM events

```tsx
import { render, screen, fireEvent } from '@testing-library/react';

it('handles click events', () => {
  const handleClick = vi.fn();
  render(<Button onClick={handleClick}>Click me</Button>);
  fireEvent.click(screen.getByText('Click me'));
  expect(handleClick).toHaveBeenCalledOnce();
});
```

For more realistic user interaction (focus, typing, scroll), prefer `userEvent` from `@testing-library/user-event`.

## Don'ts

- Don't test implementation details (internal function calls, props shape beyond what's publicly documented).
- Don't create tests that depend on the order of other tests.
- Don't use real external services (Stripe live mode, Postmark). Mock them.
- Don't leave the DB dirty between tests without a good reason.
- Don't write an e2e test for behavior a unit or server test could cover.
- Don't mix raw `env.DB.prepare(...)` with Drizzle queries in a test -- use Drizzle consistently.

## Resources

- [Vitest Documentation](https://vitest.dev/guide/)
- [Testing Library (React)](https://testing-library.com/docs/react-testing-library/intro)
- [Playwright](https://playwright.dev/docs/intro)
- [AMSTAR 2 Official Website](https://amstar.ca/Amstar-2.php) (domain reference)

## Related Guides

- [API Development Guide](/guides/api-development)
- [Components Guide](/guides/components)
- [State Management Guide](/guides/state-management)
