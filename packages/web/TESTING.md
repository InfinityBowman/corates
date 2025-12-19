# Testing Guide for CoRATES Web

This document provides guidelines and resources for testing the CoRATES frontend application.

## Testing Stack

- **Test Runner**: [Vitest](https://vitest.dev/) - Fast, Vite-native testing framework
- **Component Testing**: [@solidjs/testing-library](https://github.com/solidjs/solid-testing-library) - Testing utilities for SolidJS
- **DOM Environment**: [jsdom](https://github.com/jsdom/jsdom) - JavaScript implementation of web standards for Node.js

## Running Tests

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

## Directory Structure

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

## Writing Tests

### Pure Functions

For pure utility functions, test input/output relationships:

```javascript
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

### SolidJS Components

Use `@solidjs/testing-library` for component testing:

```javascript
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

### SolidJS Primitives (Hooks)

Test primitives by rendering them in a test component:

```javascript
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

```javascript
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

```javascript
import { vi } from 'vitest';

vi.mock('@api/betterAuthStore', () => ({
  useBetterAuth: () => ({
    user: () => ({ id: 'test-user', name: 'Test' }),
    isLoggedIn: () => true,
  }),
}));
```

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

## Common Patterns

### Testing Async Operations

```javascript
import { describe, it, expect, vi } from 'vitest';

describe('async function', () => {
  it('should handle async operations', async () => {
    const result = await someAsyncFunction();
    expect(result).toBeDefined();
  });
});
```

### Testing Error States

```javascript
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

```javascript
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
