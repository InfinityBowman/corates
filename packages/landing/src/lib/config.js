// Environment configuration for the landing page
export const config = {
  appUrl: import.meta.env.VITE_PUBLIC_APP_URL || 'http://localhost:3010',
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:8787',
};

// Helper functions for common URLs
export const urls = {
  signIn: () => `${config.appUrl}/signin`,
  signUp: (plan, interval) => {
    const base = `${config.appUrl}/signup`;
    if (!plan) return base;
    const params = new URLSearchParams({ plan });
    if (interval) params.set('interval', interval);
    return `${base}?${params.toString()}`;
  },
  checklist: () => `${config.appUrl}/checklist?from=landing`,
  dashboard: () => `${config.appUrl}/dashboard`,
};
