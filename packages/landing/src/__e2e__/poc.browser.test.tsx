/**
 * Proof of concept: Vitest Browser Mode + React + TanStack Router
 *
 * Step 1: Basic React rendering (no app deps)
 * Step 2: Full app rendering with TanStack Router
 */

import { describe, it, expect, afterEach } from 'vitest';
import { page } from 'vitest/browser';
import { render, cleanup } from 'vitest-browser-react';
import React from 'react';
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { routeTree } from '@/routeTree.gen';

// -- Step 1: Basic rendering --

describe('POC Step 1: Basic React rendering', () => {
  afterEach(cleanup);

  it('renders and interacts with a React component', async () => {
    function Counter() {
      const [count, setCount] = React.useState(0);
      return (
        <div>
          <span data-testid='count'>{count}</span>
          <button onClick={() => setCount(c => c + 1)}>Increment</button>
        </div>
      );
    }

    render(<Counter />);
    await expect.element(page.getByTestId('count')).toHaveTextContent('0');
    await page.getByRole('button', { name: 'Increment' }).click();
    await expect.element(page.getByTestId('count')).toHaveTextContent('1');
  });
});

// -- Step 2: Full app with TanStack Router --

function createTestApp(initialPath: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const memoryHistory = createMemoryHistory({ initialEntries: [initialPath] });
  const router = createRouter({
    routeTree,
    history: memoryHistory,
  });

  return function TestApp() {
    return (
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    );
  };
}

describe('POC Step 2: Full app rendering', () => {
  afterEach(cleanup);

  it('renders the signin page via TanStack Router', async () => {
    const TestApp = createTestApp('/signin');
    render(<TestApp />);

    // The signin page has "Welcome Back" heading
    await expect.element(page.getByText('Welcome Back')).toBeVisible({ timeout: 10_000 });
  });
});
