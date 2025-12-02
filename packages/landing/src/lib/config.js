// Environment configuration for the landing page
export const config = {
  appUrl: import.meta.env.VITE_PUBLIC_APP_URL || 'https://app.corates.org',
};

// Helper functions for common URLs
export const urls = {
  signIn: () => `${config.appUrl}/signin`,
  signUp: () => `${config.appUrl}/signup`,
  checklist: () => `${config.appUrl}/checklist`,
};
