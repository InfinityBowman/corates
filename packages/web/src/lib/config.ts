export const config = {
  appUrl: import.meta.env.VITE_PUBLIC_APP_URL || 'https://corates.localhost',
  apiUrl: import.meta.env.VITE_API_URL || 'https://corates.localhost',
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
