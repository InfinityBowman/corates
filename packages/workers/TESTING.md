# Backend Testing Guide

This document describes the testing environment and best practices for the Cloudflare Workers backend.

## Test Environment Configuration

### Vitest Configuration

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

## Test Utilities

### Database Helpers (`src/__tests__/helpers.js`)

- `resetTestDatabase()` - Drops and recreates all tables for a clean state
- `seedUser()`, `seedProject()`, `seedProjectMember()`, etc. - Helper functions to insert test data
- `createTestEnv()` - Creates a mocked `env` object with all necessary bindings
- `json()` - Helper to parse JSON responses
- `fetchApp()` - Helper to make requests against a Hono app in the test environment

### Common Patterns

#### Testing Routes with Authentication

```javascript
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

#### Testing with Durable Objects

When testing routes that interact with Durable Objects:
- Ensure all Durable Object operations are properly awaited
- Mock Durable Object bindings in test helpers if needed
- Be aware that Durable Objects persist across tests when `isolatedStorage: false`

#### Testing Database Operations

Always use Drizzle queries in tests (matching production code):
```javascript
import { createDb } from '../../../db/client.js';
import { getSubscriptionByStripeSubscriptionId } from '../../../db/subscriptions.js';

const db = createDb(env.DB);
const subscription = await getSubscriptionByStripeSubscriptionId(db, 'sub-id');
```

## Known Issues and Solutions

### EADDRNOTAVAIL Errors

**Problem**: Network address conflicts when multiple test processes try to bind to ports.

**Solution**: Set `singleWorker: true` in vitest config to run tests serially.

### Isolated Storage Failed

**Problem**: Durable Objects storage not being cleaned up properly between tests.

**Solution**: Set `isolatedStorage: false` and rely on database resets for test isolation.

### Postmark Syntax Errors

**Problem**: Postmark library causes syntax errors when loaded in test environment.

**Solution**: Mock postmark globally in `src/__tests__/setup.js`.

### Database Updates Not Persisting

**Problem**: Updates made through Drizzle aren't visible in subsequent queries.

**Solution**:
- Ensure all database operations are properly awaited
- Use Drizzle queries consistently (don't mix raw D1 queries with Drizzle)
- Query the database using the same Drizzle instance that performed the update

## Running Tests

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

## Best Practices

1. **Always reset the database** in `beforeEach` hooks
2. **Use unique test data** (unique IDs, emails, etc.) to avoid conflicts
3. **Mock external dependencies** (Postmark, Stripe, etc.) at the test file level or globally
4. **Await all async operations** to ensure proper cleanup
5. **Use Drizzle queries** in tests to match production code behavior
6. **Test in isolation** - each test should be independent and not rely on other tests

## Test File Structure

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
