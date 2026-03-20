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

import { API_BASE } from '@/config/api';
import { handleFetchError } from '@/lib/error-utils';

interface ApiError {
  message?: string;
  code?: string;
  statusCode?: number;
  stack?: string;
}

interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (_error: ApiError, _attempt: number, _maxRetries: number) => boolean;
}

interface ToastMessage {
  title?: string;
  description?: string;
}

interface ApiFetchOptions {
  method?: string;
  body?: Record<string, unknown> | FormData | Blob | string | null;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  raw?: boolean;
  toastMessage?: string | ToastMessage | false;
  showToast?: boolean;
  retry?: number;
  retryOptions?: RetryOptions;
  onError?: (_error: ApiError) => void;
  navigate?: (_opts: { to: string; replace?: boolean }) => void;
}

interface ResolvedRetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  shouldRetry: (_error: ApiError, _attempt: number, _maxRetries: number) => boolean;
}

const DEFAULT_RETRY_OPTIONS: ResolvedRetryConfig = {
  maxRetries: 0,
  baseDelayMs: 500,
  maxDelayMs: 10000,
  shouldRetry: (error, attempt, maxRetries) => {
    if (attempt >= maxRetries) return false;
    if (error.code?.startsWith('TRANSPORT_')) return true;
    if (error.statusCode && error.statusCode >= 500) return true;
    return false;
  },
};

function calculateBackoff(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const exponentialDelay = baseDelayMs * 2 ** attempt;
  const jitter = Math.random() * 0.3 * exponentialDelay;
  return Math.min(exponentialDelay + jitter, maxDelayMs);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (signal) {
        signal.removeEventListener('abort', abortHandler);
      }
      resolve();
    }, ms);

    let abortHandler: () => void;
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Fetch wrapper for CoRATES API calls.
 *
 * @example
 * // Simple GET
 * const projects = await apiFetch<Project[]>('/api/projects');
 *
 * @example
 * // POST with JSON body
 * const project = await apiFetch<Project>('/api/projects', {
 *   method: 'POST',
 *   body: { name: 'New Project' },
 * });
 *
 * @example
 * // FormData upload (raw response)
 * const fd = new FormData();
 * fd.append('file', file);
 * await apiFetch('/api/upload', { method: 'POST', body: fd, raw: true });
 */
async function apiFetchImpl<T = unknown>(path: string, options: ApiFetchOptions = {}): Promise<T> {
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

  const retryConfig: ResolvedRetryConfig = {
    ...DEFAULT_RETRY_OPTIONS,
    maxRetries: retry,
    ...retryOptions,
  };

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_BASE}${normalizedPath}`;

  const headers: Record<string, string> = { ...customHeaders };
  let processedBody: BodyInit | undefined;

  if (body !== undefined) {
    if (isPlainObject(body)) {
      headers['Content-Type'] = 'application/json';
      processedBody = JSON.stringify(body);
    } else {
      processedBody = body as FormData | Blob | string;
    }
  }

  const fetchOptions: RequestInit = {
    method,
    credentials: 'include',
    headers,
    signal,
  };

  if (processedBody !== undefined && method !== 'GET' && method !== 'HEAD') {
    fetchOptions.body = processedBody;
  }

  const errorOptions: Record<string, unknown> = {
    showToast,
    onError,
    navigate,
  };

  if (toastMessage) {
    if (typeof toastMessage === 'string') {
      errorOptions.toastTitle = toastMessage;
    } else if (isPlainObject(toastMessage)) {
      errorOptions.toastTitle = toastMessage.title || toastMessage.description;
    }
  }

  let lastError: unknown;
  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      const response = await handleFetchError(fetch(url, fetchOptions), errorOptions);

      if (raw) {
        return response as T;
      }

      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return (await response.json()) as T;
      }

      const text = await response.text();
      return (text || null) as T;
    } catch (error) {
      lastError = error;
      const apiError = error as ApiError;

      console.error('[apiFetch] Request failed:', {
        url,
        method,
        attempt: attempt + 1,
        error: {
          message: apiError.message,
          code: apiError.code,
          statusCode: apiError.statusCode,
          stack: apiError.stack,
        },
      });

      if (retryConfig.shouldRetry(apiError, attempt, retryConfig.maxRetries)) {
        const delay = calculateBackoff(attempt, retryConfig.baseDelayMs, retryConfig.maxDelayMs);
        console.log(`[apiFetch] Retrying in ${delay}ms (attempt ${attempt + 2})`);
        await sleep(delay, signal);
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

type ApiFetchBody = Record<string, unknown> | FormData | Blob | string | null;

/* eslint-disable no-unused-vars */
interface ApiFetchFn {
  <T = unknown>(path: string, options?: ApiFetchOptions): Promise<T>;
  get: <T = unknown>(
    path: string,
    options?: Omit<ApiFetchOptions, 'method' | 'body'>,
  ) => Promise<T>;
  post: <T = unknown>(
    path: string,
    body?: ApiFetchBody,
    options?: Omit<ApiFetchOptions, 'method' | 'body'>,
  ) => Promise<T>;
  put: <T = unknown>(
    path: string,
    body?: ApiFetchBody,
    options?: Omit<ApiFetchOptions, 'method' | 'body'>,
  ) => Promise<T>;
  patch: <T = unknown>(
    path: string,
    body?: ApiFetchBody,
    options?: Omit<ApiFetchOptions, 'method' | 'body'>,
  ) => Promise<T>;
  delete: <T = unknown>(path: string, options?: Omit<ApiFetchOptions, 'method'>) => Promise<T>;
}
/* eslint-enable no-unused-vars */

export const apiFetch: ApiFetchFn = Object.assign(apiFetchImpl, {
  get: <T = unknown>(path: string, options: Omit<ApiFetchOptions, 'method' | 'body'> = {}) =>
    apiFetchImpl<T>(path, { ...options, method: 'GET' }),
  post: <T = unknown>(
    path: string,
    body?: ApiFetchBody,
    options: Omit<ApiFetchOptions, 'method' | 'body'> = {},
  ) => apiFetchImpl<T>(path, { ...options, method: 'POST', body }),
  put: <T = unknown>(
    path: string,
    body?: ApiFetchBody,
    options: Omit<ApiFetchOptions, 'method' | 'body'> = {},
  ) => apiFetchImpl<T>(path, { ...options, method: 'PUT', body }),
  patch: <T = unknown>(
    path: string,
    body?: ApiFetchBody,
    options: Omit<ApiFetchOptions, 'method' | 'body'> = {},
  ) => apiFetchImpl<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T = unknown>(path: string, options: Omit<ApiFetchOptions, 'method'> = {}) =>
    apiFetchImpl<T>(path, { ...options, method: 'DELETE' }),
});

export default apiFetch;
