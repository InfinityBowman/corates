/**
 * Utility to track the last used login method
 * Stores in localStorage so it persists across sessions
 */

const STORAGE_KEY = 'lastLoginMethod';

export const LOGIN_METHODS = {
  EMAIL: 'email',
  GOOGLE: 'google',
  ORCID: 'orcid',
  EMAIL_CODE: 'email_code',
} as const;

export type LoginMethod = (typeof LOGIN_METHODS)[keyof typeof LOGIN_METHODS];

export const LOGIN_METHOD_LABELS: Record<string, string> = {
  [LOGIN_METHODS.EMAIL]: 'email and password',
  [LOGIN_METHODS.GOOGLE]: 'Google',
  [LOGIN_METHODS.ORCID]: 'ORCID',
  [LOGIN_METHODS.EMAIL_CODE]: 'an email code',
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
    const stored = localStorage.getItem(STORAGE_KEY);
    // Magic links became emailed codes; browsers still hold the old value
    return stored === 'magic_link' ? LOGIN_METHODS.EMAIL_CODE : stored;
  } catch (err) {
    console.warn('Failed to get last login method from localStorage:', (err as Error).message);
    return null;
  }
}
