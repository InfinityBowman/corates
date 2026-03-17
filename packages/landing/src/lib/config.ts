export const config = {
  appUrl: import.meta.env.VITE_PUBLIC_APP_URL || 'http://localhost:5173',
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:8787',
};

export const urls = {
  signIn: () => '/signin',
  signUp: (plan?: string, interval?: string) => {
    const base = '/signup';
    if (!plan) return base;
    const params = new URLSearchParams({ plan });
    if (interval) params.set('interval', interval);
    return `${base}?${params.toString()}`;
  },
  checklist: () => '/checklist',
  dashboard: () => '/dashboard',
};
