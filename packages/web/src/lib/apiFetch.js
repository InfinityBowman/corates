/**
 * API Fetch Wrapper
 *
 * Provides a standardized fetch wrapper for app-level API calls with:
 * - Base URL prefixing and credentials
 * - Automatic JSON stringify/parse
 * - FormData/Blob passthrough
 * - Integration with handleFetchError and toast notifications
 * - Abort signal support
 * - Optional retry with exponential backoff (opt-in, default off)
 *
 * Use this for all calls to the CoRATES backend API.
 * Do NOT use for: WebSocket upgrades, streaming, presigned uploads.
 */

import { API_BASE } from '@config/api.js';
import { handleFetchError } from '@lib/error-utils.js';

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_OPTIONS = {
  maxRetries: 0, // disabled by default
  baseDelayMs: 500,
  maxDelayMs: 10000,
  // Only retry on network errors or 5xx; never on 4xx
  shouldRetry: (error, attempt, maxRetries) => {
    if (attempt >= maxRetries) return false;
    // Retry on transport/network errors
    if (error.code?.startsWith('TRANSPORT_')) return true;
    // Retry on 5xx server errors
    if (error.statusCode >= 500) return true;
    return false;
  },
};

/**
 * Calculate delay with exponential backoff and jitter
 * @param {number} attempt - Current attempt number (0-indexed)
 * @param {number} baseDelayMs - Base delay in milliseconds
 * @param {number} maxDelayMs - Maximum delay cap
 * @returns {number} Delay in milliseconds
 */
function calculateBackoff(attempt, baseDelayMs, maxDelayMs) {
  const exponentialDelay = baseDelayMs * 2 ** attempt;
  const jitter = Math.random() * 0.3 * exponentialDelay; // 0-30% jitter
  return Math.min(exponentialDelay + jitter, maxDelayMs);
}

/**
 * Sleep for a given duration
 * @param {number} ms - Milliseconds to sleep
 * @param {AbortSignal} [signal] - Optional abort signal
 * @returns {Promise<void>}
 */
function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (signal) {
        signal.removeEventListener('abort', abortHandler);
      }
      resolve();
    }, ms);

    let abortHandler;
    if (signal) {
      abortHandler = () => {
        clearTimeout(timeout);
        signal.removeEventListener('abort', abortHandler);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      signal.addEventListener('abort', abortHandler);
    }
  });
}

/**
 * Check if a value is a plain object (not FormData, Blob, etc.)
 * @param {*} value - Value to check
 * @returns {boolean}
 */
function isPlainObject(value) {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Fetch wrapper for CoRATES API calls
 *
 * @param {string} path - API path (e.g., '/api/projects' or 'api/projects')
 * @param {Object} [options={}] - Fetch options
 * @param {string} [options.method='GET'] - HTTP method
 * @param {Object|FormData|Blob|string} [options.body] - Request body (auto-stringified if plain object)
 * @param {Object} [options.headers] - Additional headers (merged with defaults)
 * @param {AbortSignal} [options.signal] - Abort signal for cancellation
 * @param {boolean} [options.raw=false] - If true, return raw Response instead of parsed JSON
 * @param {string|Object} [options.toastMessage] - Custom toast message on error (string or { title, description })
 * @param {boolean} [options.showToast=true] - Whether to show toast on error
 * @param {number} [options.retry=0] - Number of retry attempts (0 = disabled)
 * @param {Object} [options.retryOptions] - Custom retry configuration
 * @param {Function} [options.onError] - Custom error callback
 * @param {Function} [options.navigate] - Navigation function for auth redirects
 * @returns {Promise<any>} Parsed JSON response (or Response if raw=true)
 * @throws {DomainError|TransportError} On request failure
 *
 * @example
 * // Simple GET
 * const projects = await apiFetch('/api/projects');
 *
 * @example
 * // POST with JSON body
 * const project = await apiFetch('/api/projects', {
 *   method: 'POST',
 *   body: { name: 'New Project' },
 * });
 *
 * @example
 * // Custom toast message
 * const data = await apiFetch('/api/data', {
 *   toastMessage: 'Failed to load data',
 * });
 *
 * @example
 * // FormData upload
 * const fd = new FormData();
 * fd.append('file', file);
 * await apiFetch('/api/upload', { method: 'POST', body: fd, raw: true });
 *
 * @example
 * // With retry (for GET requests)
 * const data = await apiFetch('/api/data', { retry: 2 });
 */
export async function apiFetch(path, options = {}) {
  const {
    method = 'GET',
    body,
    headers: customHeaders = {},
    signal,
    raw = false,
    toastMessage,
    showToast = true,
    retry = 0,
    retryOptions = {},
    onError,
    navigate,
  } = options;

  // Merge retry options with defaults
  const retryConfig = {
    ...DEFAULT_RETRY_OPTIONS,
    maxRetries: retry,
    ...retryOptions,
  };

  // Build URL - handle paths with or without leading slash
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_BASE}${normalizedPath}`;

  // Build headers - only set Content-Type for JSON bodies
  const headers = { ...customHeaders };
  let processedBody = body;

  if (body !== undefined) {
    if (isPlainObject(body)) {
      // Plain object: stringify and set JSON content type
      headers['Content-Type'] = 'application/json';
      processedBody = JSON.stringify(body);
    }
    // FormData, Blob, string: pass through as-is (browser sets correct headers)
  }

  // Build fetch options
  const fetchOptions = {
    method,
    credentials: 'include',
    headers,
    signal,
  };

  if (processedBody !== undefined && method !== 'GET' && method !== 'HEAD') {
    fetchOptions.body = processedBody;
  }

  // Build error handling options
  const errorOptions = {
    showToast,
    onError,
    navigate,
  };

  // Handle custom toast message
  if (toastMessage) {
    if (typeof toastMessage === 'string') {
      errorOptions.toastTitle = toastMessage;
    } else if (isPlainObject(toastMessage)) {
      errorOptions.toastTitle = toastMessage.title || toastMessage.description;
    }
  }

  // Execute with retry logic
  let lastError;
  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      // Use handleFetchError for consistent error handling
      const response = await handleFetchError(fetch(url, fetchOptions), errorOptions);

      // Return raw response if requested
      if (raw) {
        return response;
      }

      // Parse JSON response
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return await response.json();
      }

      // Non-JSON response: return text or empty
      const text = await response.text();
      return text || null;
    } catch (error) {
      lastError = error;

      // Log error details for debugging
      console.error('[apiFetch] Request failed:', {
        url,
        method,
        attempt: attempt + 1,
        error: {
          message: error.message,
          code: error.code,
          statusCode: error.statusCode,
          stack: error.stack,
        },
      });

      // Check if we should retry
      if (retryConfig.shouldRetry(error, attempt, retryConfig.maxRetries)) {
        const delay = calculateBackoff(attempt, retryConfig.baseDelayMs, retryConfig.maxDelayMs);
        console.log(`[apiFetch] Retrying in ${delay}ms (attempt ${attempt + 2})`);
        await sleep(delay, signal);
        continue;
      }

      // No retry - throw the error
      throw error;
    }
  }

  // Should not reach here, but throw last error if we do
  throw lastError;
}

/**
 * Convenience methods for common HTTP verbs
 */
apiFetch.get = (path, options = {}) => apiFetch(path, { ...options, method: 'GET' });
apiFetch.post = (path, body, options = {}) => apiFetch(path, { ...options, method: 'POST', body });
apiFetch.put = (path, body, options = {}) => apiFetch(path, { ...options, method: 'PUT', body });
apiFetch.patch = (path, body, options = {}) =>
  apiFetch(path, { ...options, method: 'PATCH', body });
apiFetch.delete = (path, options = {}) => apiFetch(path, { ...options, method: 'DELETE' });

export default apiFetch;
