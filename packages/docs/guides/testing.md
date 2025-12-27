# Testing Guide

This guide covers testing philosophy, patterns, and best practices for both frontend and backend testing in CoRATES.

## Overview

CoRATES uses Vitest for testing with different configurations for frontend (SolidJS) and backend (Cloudflare Workers). Tests follow a behavior-driven approach, focusing on intended behavior rather than implementation details.

## Testing Philosophy

### Behavior-Driven Testing

Tests should validate **intended behavior**, not implementation details. The current implementation may contain bugs, so tests should be written based on:

1. Function/component names and their semantic meaning
2. JSDoc comments and inline documentation
3. Domain conventions (AMSTAR-2 methodology, systematic review practices)
4. Expected UX patterns

### Test Structure

Follow the AAA pattern:

- **Arrange**: Set up test data and conditions
- **Act**: Execute the code being tested
- **Assert**: Verify the expected outcomes

## Frontend Testing

### Test Stack

- **Test Runner**: [Vitest](https://vitest.dev/) - Fast, Vite-native testing framework
- **Component Testing**: [@solidjs/testing-library](https://github.com/solidjs/solid-testing-library) - Testing utilities for SolidJS
- **DOM Environment**: [jsdom](https://github.com/jsdom/jsdom) - JavaScript implementation of web standards for Node.js

### Running Tests

```bash
# Run tests with UI
pnpm test

# Run tests in watch mode (headless)
pnpm vitest

# Run tests once (CI mode)
pnpm vitest run

# Run tests with coverage
pnpm vitest run --coverage
```

### Directory Structure

```
src/
  __tests__/           # Global test utilities and setup
    setup.js           # Test setup file
  config/
    __tests__/         # Tests for config modules
  primitives/
    __tests__/         # Tests for hooks/primitives
  lib/
    __tests__/         # Tests for utility functions
  AMSTAR2/
    __tests__/         # Tests for AMSTAR2 logic
  components/
    __tests__/         # Tests for shared components
    auth-ui/
      __tests__/       # Tests for auth components
    project-ui/
      __tests__/       # Tests for project components
    checklist-ui/
      __tests__/       # Tests for checklist components
```

### Testing Pure Functions

For pure utility functions, test input/output relationships:

```js
import { describe, it, expect } from 'vitest';
import { formatDate } from '../dateUtils';

describe('formatDate', () => {
  it('should format ISO date strings correctly', () => {
    expect(formatDate('2025-01-15T10:30:00Z')).toBe('1/15/2025');
  });

  it('should handle Unix timestamps in seconds', () => {
    expect(formatDate(1705312200)).toBe('1/15/2024');
  });

  it('should return empty string for invalid input', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
  });
});
```

### Testing SolidJS Components

Use `@solidjs/testing-library` for component testing:

```js
import { describe, it, expect } from 'vitest';
import { render, screen } from '@solidjs/testing-library';
import MyComponent from '../MyComponent';

describe('MyComponent', () => {
  it('should render the title', () => {
    render(() => <MyComponent title='Hello' />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### Testing SolidJS Primitives (Hooks)

Test primitives by rendering them in a test component:

```js
import { describe, it, expect } from 'vitest';
import { createRoot } from 'solid-js';
import useOnlineStatus from '../useOnlineStatus';

describe('useOnlineStatus', () => {
  it('should return true when browser is online', () => {
    let result;
    createRoot(dispose => {
      result = useOnlineStatus();
      dispose();
    });
    expect(result()).toBe(navigator.onLine);
  });
});
```

### Mocking

#### Mocking Browser APIs

```js
import { vi } from 'vitest';

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  value: true,
  writable: true,
});

// Mock IndexedDB
const mockIndexedDB = {
  open: vi.fn(),
};
global.indexedDB = mockIndexedDB;
```

#### Mocking Modules

```js
import { vi } from 'vitest';

vi.mock('@api/better-auth-store', () => ({
  useBetterAuth: () => ({
    user: () => ({ id: 'test-user', name: 'Test' }),
    isLoggedIn: () => true,
  }),
}));
```

## Backend Testing

### Test Environment Configuration

The test suite uses Vitest with the `@cloudflare/vitest-pool-workers` pool to run tests in a Workers-like environment.

**Key Configuration (`vitest.config.js`):**

- `singleWorker: true` - Runs tests serially in a single worker process to avoid network address conflicts
- `isolatedStorage: false` - Disabled to avoid Durable Object cleanup issues (tests use database resets for isolation instead)
- `testTimeout: 10000` - Increased timeout for Durable Object operations
- `setupFiles: ['./src/__tests__/setup.js']` - Global setup file that mocks external dependencies

### Global Test Setup

The `src/__tests__/setup.js` file runs before all tests and provides:

- **Postmark Mock**: Prevents syntax errors from loading the postmark library
- **Stripe Mock**: Provides default Stripe mocks (tests can override with specific mocks)

### Test Isolation

Tests are isolated through:

1. **Database Resets**: Each test file should call `resetTestDatabase()` in `beforeEach` to ensure a clean database state
2. **Mock Clearing**: Use `vi.clearAllMocks()` in `beforeEach` to reset mock state
3. **Unique Test Data**: Use unique IDs for test data to avoid conflicts between tests

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run specific test file
pnpm test src/routes/__tests__/projects.test.js

# Run tests matching a pattern
pnpm test -t "should create"
```

### Test Utilities

#### Database Helpers (`src/__tests__/helpers.js`)

- `resetTestDatabase()` - Drops and recreates all tables for a clean state
- `seedUser()`, `seedProject()`, `seedProjectMember()`, etc. - Helper functions to insert test data
- `createTestEnv()` - Creates a mocked `env` object with all necessary bindings
- `json()` - Helper to parse JSON responses
- `fetchApp()` - Helper to make requests against a Hono app in the test environment

#### Database Helpers Usage

```js
import { resetTestDatabase, seedUser, seedProject } from './helpers.js';

beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
});

it('should create a project', async () => {
  const user = await seedUser({ id: 'user-1', email: 'test@example.com' });
  const project = await seedProject({ id: 'proj-1', createdBy: user.id });
  // Test project creation
});
```

#### Route Testing

```js
import { fetchApp } from './helpers.js';
import app from '../../index.js';

it('should create a project', async () => {
  const response = await fetchApp(app, '/api/projects', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-test-user-id': 'user-1',
    },
    body: JSON.stringify({ name: 'Test Project' }),
  });

  expect(response.status).toBe(201);
  const data = await response.json();
  expect(data.name).toBe('Test Project');
});
```

#### Testing Routes with Authentication

```js
// Mock auth middleware
vi.mock('../../middleware/auth.js', () => {
  return {
    requireAuth: async (c, next) => {
      const userId = c.req.raw.headers.get('x-test-user-id') || 'user-1';
      c.set('user', { id: userId, email: 'test@example.com' });
      await next();
    },
  };
});
```

### Testing with Durable Objects

When testing routes that interact with Durable Objects:

- Ensure all Durable Object operations are properly awaited
- Mock Durable Object bindings in test helpers if needed
- Be aware that Durable Objects persist across tests when `isolatedStorage: false`

### Testing Database Operations

Always use Drizzle queries in tests (matching production code):

```js
import { createDb } from '../../../db/client.js';
import { getSubscriptionByStripeSubscriptionId } from '../../../db/subscriptions.js';

const db = createDb(env.DB);
const subscription = await getSubscriptionByStripeSubscriptionId(db, 'sub-id');
```

### Known Issues and Solutions

#### EADDRNOTAVAIL Errors

**Problem**: Network address conflicts when multiple test processes try to bind to ports.

**Solution**: Set `singleWorker: true` in vitest config to run tests serially.

#### Isolated Storage Failed

**Problem**: Durable Objects storage not being cleaned up properly between tests.

**Solution**: Set `isolatedStorage: false` and rely on database resets for test isolation.

#### Postmark Syntax Errors

**Problem**: Postmark library causes syntax errors when loaded in test environment.

**Solution**: Mock postmark globally in `src/__tests__/setup.js`.

#### Database Updates Not Persisting

**Problem**: Updates made through Drizzle aren't visible in subsequent queries.

**Solution**:

- Ensure all database operations are properly awaited
- Use Drizzle queries consistently (don't mix raw D1 queries with Drizzle)
- Query the database using the same Drizzle instance that performed the update

### Test File Structure

```
src/
  __tests__/
    setup.js          # Global test setup
    helpers.js        # Shared test utilities
    *.test.js         # Test files
  routes/
    __tests__/
      *.test.js       # Route-specific tests
  middleware/
    __tests__/
      *.test.js       # Middleware tests
```

## Common Patterns

### Testing Async Operations

```js
import { describe, it, expect, vi } from 'vitest';

describe('async function', () => {
  it('should handle async operations', async () => {
    const result = await someAsyncFunction();
    expect(result).toBeDefined();
  });
});
```

### Testing Error States

```js
describe('error handling', () => {
  it('should throw on invalid input', () => {
    expect(() => validateInput(null)).toThrow('Input required');
  });

  it('should handle rejected promises', async () => {
    await expect(asyncFn()).rejects.toThrow('Expected error');
  });
});
```

### Testing DOM Events

```js
import { fireEvent } from '@solidjs/testing-library';

it('should handle click events', async () => {
  const handleClick = vi.fn();
  render(() => <Button onClick={handleClick}>Click me</Button>);

  fireEvent.click(screen.getByText('Click me'));
  expect(handleClick).toHaveBeenCalledOnce();
});
```

## Flags for Potential Bugs

When writing tests, if you discover behavior that conflicts with the expected/intended behavior:

1. Write the test for the **intended** behavior
2. Add a comment like `// BUG: Current implementation does X, but should do Y`
3. The test will fail, highlighting the bug for fixing

## Best Practices

### DO

- Write tests for intended behavior, not implementation
- Use AAA pattern (Arrange, Act, Assert)
- Test edge cases and error conditions
- Mock external dependencies
- Keep tests isolated and independent
- Use descriptive test names
- Reset database state between tests (backend)
- Always reset the database in `beforeEach` hooks (backend)
- Use unique test data (unique IDs, emails, etc.) to avoid conflicts (backend)
- Mock external dependencies (Postmark, Stripe, etc.) at the test file level or globally (backend)
- Await all async operations to ensure proper cleanup (backend)
- Use Drizzle queries in tests to match production code behavior (backend)
- Test in isolation - each test should be independent and not rely on other tests (backend)

### DON'T

- Don't test implementation details
- Don't create tests that depend on other tests
- Don't forget to clean up (database, mocks)
- Don't use real external services in tests
- Don't skip error handling tests

## Resources

### Official Documentation

- [Vitest Documentation](https://vitest.dev/guide/)
- [SolidJS Testing Library](https://github.com/solidjs/solid-testing-library)
- [Testing Library Queries](https://testing-library.com/docs/queries/about)
- [Vitest Mocking](https://vitest.dev/guide/mocking.html)

### SolidJS-Specific Testing

- [SolidJS Testing Best Practices](https://www.solidjs.com/guides/testing)
- [Testing Reactive Primitives](https://github.com/solidjs/solid-testing-library#primitives)

### AMSTAR-2 Domain Knowledge

- [AMSTAR 2 Official Website](https://amstar.ca/Amstar-2.php)
- [AMSTAR 2 Checklist PDF](https://amstar.ca/Amstar_Checklist.php)

## Related Guides

- [API Development Guide](/guides/api-development) - For backend patterns
- [Component Development Guide](/guides/components) - For frontend patterns
