const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status, code, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let refreshInFlight = null;
const noRefreshPaths = new Set(['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout']);
const isAuthEndpoint = (path) => noRefreshPaths.has(path);

async function send(path, options = {}, allowRefresh = true) {
  const headers = new Headers(options.headers || {});
  headers.set('Accept', 'application/json');
  let body = options.body;
  if (body && !(body instanceof FormData) && typeof body !== 'string') {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(body);
  }
  const response = await fetch(`${API_URL}${path.startsWith('/') ? path : `/${path}`}`, {
    ...options,
    body,
    headers,
    credentials: 'include',
  });

  if (response.status === 401 && allowRefresh && !isAuthEndpoint(path)) {
    try {
      refreshInFlight ??= fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include', headers: { Accept: 'application/json' } })
        .finally(() => { refreshInFlight = null; });
      const refreshed = await refreshInFlight;
      if (refreshed.ok) return send(path, options, false);
    } catch { /* Preserve the original request's authentication error. */ }
  }

  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.error || {};
    throw new ApiError(detail.message || `Request failed (${response.status}).`, response.status, detail.code, detail.details);
  }
  return payload;
}

export const api = {
  get: (path, options = {}) => send(path, { ...options, method: 'GET' }),
  post: (path, body, options = {}) => send(path, { ...options, method: 'POST', ...(body === undefined ? {} : { body }) }),
  patch: (path, body, options = {}) => send(path, { ...options, method: 'PATCH', body }),
  delete: (path, options = {}) => send(path, { ...options, method: 'DELETE' }),
};

export const API_ORIGIN = (import.meta.env.VITE_API_ORIGIN || 'http://localhost:5000').replace(/\/$/, '');
export function imageUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}
