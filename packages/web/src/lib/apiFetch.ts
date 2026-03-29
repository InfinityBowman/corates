/**
 * API Fetch Wrapper
 *
 * Thin fetch wrapper for endpoints not on the typed Hono RPC router:
 * - Better Auth endpoints (/api/auth/*)
 * - Binary uploads/downloads (FormData, raw Response)
 *
 * For typed JSON endpoints, use the RPC client from '@/lib/rpc' instead.
 */

import { API_BASE } from '@/config/api';
import { handleFetchError } from '@/lib/error-utils';

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
  onError?: (_error: { code?: string; message?: string; statusCode?: number }) => void;
  navigate?: (_opts: { to: string; replace?: boolean }) => void;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

async function apiFetchImpl<T = unknown>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const {
    method = 'GET',
    body,
    headers: customHeaders = {},
    signal,
    raw = false,
    toastMessage,
    showToast = true,
    onError,
    navigate,
  } = options;

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
}

type ApiFetchBody = Record<string, unknown> | FormData | Blob | string | null;

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
