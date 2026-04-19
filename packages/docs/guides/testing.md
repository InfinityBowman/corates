# Testing Guide

CoRATES uses Vitest for unit and server tests, and Playwright for end-to-end tests. This guide covers the three test layers, when to use each, and the conventions they follow.

## Test layers

| Layer | Runs in | Config | File pattern | Purpose |
| --- | --- | --- | --- | --- |
| Unit | jsdom | `vitest.config.ts` | `*.test.ts[x]` | Pure functions, hooks, Zustand stores, React components |
| Server | Workers pool | `vitest.server.config.ts` | `*.server.test.ts` | TanStack Start route handlers against a real D1 + bindings |
| Browser | real browser (vitest-browser-react) | `vitest.browser.config.ts` | `*.browser.test.tsx` | Component tests needing real layout/IO |
| E2E | Playwright | `playwright.config.ts` | `*.spec.ts` (under `tests/e2e/`) | Full user flows against a running dev server |

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

When you discover a bug while writing a test, write the test for the *intended* behavior and add a `// BUG:` comment explaining the divergence. The failing test is the bug report.

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
    render(<MyComponent title="Hello" />);
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

vi.mock('@/api/auth-client', () => ({
  authClient: { organization: { list: vi.fn() } },
  authFetch: vi.fn(),
}));
```

Prefer pre-seeding stores and query caches over mocking the modules that consume them -- mocks drift; state snapshots don't.

### Browser APIs

```ts
Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
```

`localStorage`, `indexedDB`, `BroadcastChannel`, and `crypto.subtle` are all available under jsdom.

## Server tests

Server tests live next to the route file under `__tests__/` with the `*.server.test.ts` suffix. They import the route's named handler directly and call it with a synthesized `Request`.

```ts
import { describe, expect, it } from 'vitest';
import { handleGet } from '../health';

describe('GET /health', () => {
  it('returns 200 + healthy when all dependencies respond', async () => {
    const res = await handleGet();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('healthy');
  });
});
```

For handlers that take `{ request }`:

```ts
const res = await handlePost({
  request: new Request('https://x/api/billing/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: 'session=...' },
    body: JSON.stringify({ tier: 'pro', interval: 'monthly' }),
  }),
});
```

The server config runs in the Cloudflare Workers pool, so `env.DB`, R2, Durable Object bindings, and `cloudflare:workers` imports all resolve against a test D1 database prepared by `pnpm db:generate:test`.

### Database isolation

Server tests share the test D1. Each test file that mutates data should reset the DB in `beforeEach` via the shared helpers, or scope its assertions to unique IDs. Do not rely on cross-file ordering.

### Mocking external services

Postmark and Stripe are mocked globally in the server setup file to avoid hitting real services or triggering startup failures in the test Worker. Individual tests can override these mocks per-test with `vi.mocked(...).mockReturnValueOnce(...)`.

## Browser tests

`*.browser.test.tsx` files run under `vitest-browser-react` against a real browser (Playwright-controlled). Use these only when jsdom cannot represent the behavior -- real layout measurements, pointer events on shadcn popovers, IntersectionObserver, etc.

## E2E tests

Playwright specs live under `packages/web/tests/e2e/`. They run against a dev server the user starts manually (`pnpm --filter web dev`). Ask the user to confirm the server is running before invoking `test:e2e`.

Prefer e2e coverage on:

- Sign-in / sign-up flows.
- Stripe checkout and subscription state transitions.
- Collaborative editing (two browser contexts against the same project).

Do not use e2e for what a unit or server test can cover. They are the slowest and most brittle layer.

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
