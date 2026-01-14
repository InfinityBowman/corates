/**
 * Shared utilities for test factories
 */

/**
 * Generate a unique ID with optional prefix
 * @param {string} [prefix] - Optional prefix for the ID
 * @returns {string} Generated ID
 */
export function generateId(prefix = '') {
  const uuid = crypto.randomUUID();
  return prefix ? `${prefix}-${uuid.slice(0, 8)}` : uuid;
}

/**
 * Get current timestamp in seconds (for database fields)
 * @returns {number} Current Unix timestamp in seconds
 */
export function nowSec() {
  return Math.floor(Date.now() / 1000);
}

/**
 * Get current timestamp as Date
 * @returns {Date} Current date
 */
export function nowDate() {
  return new Date();
}

/**
 * Merge defaults with overrides, preferring overrides
 * @param {Object} defaults - Default values
 * @param {Object} [overrides] - Override values
 * @returns {Object} Merged object
 */
export function withDefaults(defaults, overrides = {}) {
  return { ...defaults, ...overrides };
}

/**
 * Generate a test email from an ID
 * @param {string} id - ID to base email on
 * @returns {string} Generated email
 */
export function emailFromId(id) {
  return `${id}@test.example.com`;
}

/**
 * Generate a slug from a name
 * @param {string} name - Name to slugify
 * @returns {string} Slugified name
 */
export function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Counter for generating sequential names
 */
let counter = 0;

/**
 * Get next counter value (for unique names)
 * @returns {number} Next counter value
 */
export function nextCounter() {
  return ++counter;
}

/**
 * Reset counter to 0 (call in beforeEach)
 */
export function resetCounter() {
  counter = 0;
}
