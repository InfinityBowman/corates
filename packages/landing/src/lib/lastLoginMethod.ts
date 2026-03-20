/**
 * Utility to track the last used login method
 * Stores in localStorage so it persists across sessions
 */

const STORAGE_KEY = 'lastLoginMethod';

export const LOGIN_METHODS = {
  EMAIL: 'email',
  GOOGLE: 'google',
  ORCID: 'orcid',
  MAGIC_LINK: 'magic_link',
} as const;

export type LoginMethod = (typeof LOGIN_METHODS)[keyof typeof LOGIN_METHODS];

export const LOGIN_METHOD_LABELS: Record<string, string> = {
  [LOGIN_METHODS.EMAIL]: 'email and password',
  [LOGIN_METHODS.GOOGLE]: 'Google',
  [LOGIN_METHODS.ORCID]: 'ORCID',
  [LOGIN_METHODS.MAGIC_LINK]: 'email link',
};

export function saveLastLoginMethod(method: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, method);
  } catch (e) {
    console.warn('Could not save login method:', e);
  }
}

export function getLastLoginMethod(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to get last login method from localStorage:', (err as Error).message);
    return null;
  }
}
