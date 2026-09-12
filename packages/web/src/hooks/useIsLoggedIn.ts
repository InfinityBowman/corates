import { useHydrated } from '@tanstack/react-router';
import { useAuthStore, selectIsLoggedIn } from '@/stores/authStore';

// cachedUser is read synchronously from localStorage, so the store can say
// "logged in" on the client's first render while the server said "logged out".
// Hold the logged-out answer until hydration so both renders agree.
export function useIsLoggedIn(): boolean {
  const isHydrated = useHydrated();
  return useAuthStore(selectIsLoggedIn) && isHydrated;
}
