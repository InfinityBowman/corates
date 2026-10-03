import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSlugAvailability } from '../useSlugAvailability';

const { checkSlug } = vi.hoisted(() => ({ checkSlug: vi.fn() }));
vi.mock('@/server/functions/workspaces.functions', () => ({ checkSlug }));

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useSlugAvailability', () => {
  it('reports a reserved slug without asking the server', () => {
    const { result } = renderHook(() => useSlugAvailability('dashboard'), { wrapper });
    expect(result.current.status.state).toBe('invalid');
    expect(checkSlug).not.toHaveBeenCalled();
  });

  it('treats the saved slug as unchanged', () => {
    const { result } = renderHook(() => useSlugAvailability('lab', { current: 'lab' }), {
      wrapper,
    });
    expect(result.current.status.state).toBe('unchanged');
  });

  it('shows an error instead of checking forever when the check fails', async () => {
    checkSlug.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useSlugAvailability('new-lab'), { wrapper });
    await waitFor(() => expect(result.current.status.state).toBe('error'), { timeout: 3000 });
  });
});
