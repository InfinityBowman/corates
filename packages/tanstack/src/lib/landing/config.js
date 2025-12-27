// Environment configuration for the landing page
export const config = {
  appUrl: import.meta.env.VITE_PUBLIC_APP_URL || 'https://corates.org',
  apiUrl: import.meta.env.VITE_API_URL || 'https://api.corates.org',
}

// Helper functions for common URLs
export const urls = {
  signIn: () => `${config.appUrl}/signin`,
  signUp: () => `${config.appUrl}/signup`,
  checklist: () => `${config.appUrl}/checklist?from=landing`,
  dashboard: () => `${config.appUrl}/dashboard`,
}
