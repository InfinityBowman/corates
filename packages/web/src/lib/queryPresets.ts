const MINUTE = 1000 * 60;

export const QUERY_FRESH = {
  staleTime: 2 * MINUTE,
  gcTime: 30 * MINUTE,
  retry: 1 as const,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
};

export const QUERY_STABLE = {
  staleTime: 5 * MINUTE,
  gcTime: 10 * MINUTE,
  retry: 1 as const,
};
