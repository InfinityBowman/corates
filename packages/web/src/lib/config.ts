export const config = {
  appUrl: import.meta.env.VITE_PUBLIC_APP_URL || 'http://corates.localhost:1355',
  apiUrl: import.meta.env.VITE_API_URL || 'http://corates.localhost:1355',
};

export const urls = {
  signUp: (plan?: string, interval?: string) => {
    const base = '/signup';
    if (!plan) return base;
    const params = new URLSearchParams({ plan });
    if (interval) params.set('interval', interval);
    return `${base}?${params.toString()}`;
  },
};
