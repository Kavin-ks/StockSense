// Thin fetch wrapper: attaches the JWT, parses JSON, and turns API errors into ApiError
// with per-field messages that forms can display next to inputs.
const TOKEN_KEY = 'stocksense.token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(status, message, fields = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

function toQuery(params = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') qs.set(k, v);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

async function request(method, path, { body, params } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`/api${path}${toQuery(params)}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.');
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized();
    const fallbackMessage = res.status === 502 || res.status === 503 || res.status === 504
      ? 'Backend server is not responding. Please make sure the server is running.'
      : res.status === 429
      ? 'Too many requests. Please wait a few moments and try again.'
      : 'Request failed. Please try again.';
    throw new ApiError(res.status, data?.error?.message ?? data?.message ?? fallbackMessage, data?.error?.fields ?? {});
  }
  return data;
}

export const api = {
  get: (path, params) => request('GET', path, { params }),
  post: (path, body) => request('POST', path, { body }),
  put: (path, body) => request('PUT', path, { body }),
  del: (path) => request('DELETE', path),
  upload: async (path, formData) => {
    const headers = {};
    const token = tokenStore.get();
    if (token) headers.Authorization = `Bearer ${token}`;
    let res;
    try {
      res = await fetch(`/api${path}`, { method: 'POST', headers, body: formData });
    } catch {
      throw new ApiError(0, 'Cannot reach the server.');
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(res.status, data?.error?.message ?? 'Upload failed');
    return data;
  },
  download: (path) => {
    const token = tokenStore.get();
    const a = document.createElement('a');
    // Use fetch to get file with auth header
    return fetch(`/api${path}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        a.href = url;
        a.download = path.split('/').pop() + '.csv';
        a.click();
        URL.revokeObjectURL(url);
      });
  },
};
