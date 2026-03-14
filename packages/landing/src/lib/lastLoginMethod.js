/**
 * Utility to track the last used login method
 * Stores in localStorage so it persists across sessions
 */

const STORAGE_KEY = 'lastLoginMethod';

/**
 * Login method types
 */
export const LOGIN_METHODS = {
  EMAIL: 'email',
  GOOGLE: 'google',
  ORCID: 'orcid',
  MAGIC_LINK: 'magic_link',
};

/**
 * Human-readable labels for login methods
 */
export const LOGIN_METHOD_LABELS = {
  [LOGIN_METHODS.EMAIL]: 'email and password',
  [LOGIN_METHODS.GOOGLE]: 'Google',
  [LOGIN_METHODS.ORCID]: 'ORCID',
  [LOGIN_METHODS.MAGIC_LINK]: 'email link',
};

/**
 * Save the login method used
 * @param {string} method - One of LOGIN_METHODS
 */
export function saveLastLoginMethod(method) {
  try {
    localStorage.setItem(STORAGE_KEY, method);
  } catch (e) {
    // localStorage might not be available
    console.warn('Could not save login method:', e);
  }
}

/**
 * Get the last login method used
 * @returns {string|null} - The login method or null if none saved
 */
export function getLastLoginMethod() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to get last login method from localStorage:', err.message);
    return null;
  }
}

/**
 * Get the human-readable label for the last login method
 * @returns {string|null} - The label or null if none saved
 */
export function getLastLoginMethodLabel() {
  const method = getLastLoginMethod();
  return method ? LOGIN_METHOD_LABELS[method] || null : null;
}

/**
 * Clear the stored login method (e.g., on sign out)
 */
export function clearLastLoginMethod() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('Failed to clear last login method from localStorage:', err.message);
  }
}
