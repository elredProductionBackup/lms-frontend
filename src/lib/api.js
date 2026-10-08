// Central API client for the LMS backend.
//
// Browser requests are intentionally SAME-ORIGIN:
//
//   /api/theProfessionalNetwork/lms/...
//
// Next.js (see next.config.mjs `rewrites`) proxies those to the real backend:
//
//   ${API_ORIGIN}/...
//
// WHY SAME-ORIGIN MATTERS
// The stream-session endpoint sets an HttpOnly, path-scoped cookie
// (stream_<courseId>_<videoId>). HLS manifest/segment/caption requests are
// authenticated by THAT cookie, not by the Bearer token. For the browser to
// send the cookie on those media requests, the request that sets the cookie
// and the media requests that consume it must share one origin. Pointing the
// browser directly at the backend origin would set the cookie on a different
// host than the (proxied, same-origin) media requests use, so it would never
// be sent and playback would 401. Everything therefore goes through the
// same-origin proxy path below.
//
// IMPORTANT:
//   - Normal API requests use Bearer JWT.
//   - Stream media requests do NOT use Bearer JWT — only the HttpOnly cookie.

// Same-origin proxy path. Overridable for non-proxied deployments via
// NEXT_PUBLIC_API_BROWSER_BASE, but the default keeps the cookie-based stream
// flow working.
const RAW_BROWSER_BASE = (process.env.NEXT_PUBLIC_API_BROWSER_BASE || "").trim();

export const API_BASE = RAW_BROWSER_BASE
  ? RAW_BROWSER_BASE.replace(/\/+$/, "")
  : "/api/theProfessionalNetwork/lms";

const DEBUG = process.env.NEXT_PUBLIC_API_DEBUG === "true";

const TOKEN_KEY = "lms.auth.token";

export function getToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (typeof window === "undefined") return;

  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_KEY);
  }
}

export function clearToken() {
  setToken(null);
}

// -----------------------------------------------------------------------------
// Session-expiry handling
// -----------------------------------------------------------------------------
//
// A single active session is enforced server-side: signing in elsewhere
// invalidates older tokens, which then fail with 401 SESSION_REPLACED. We give
// the app one place to react (clear auth + bounce to /login with a message)
// instead of scattering that logic through every thunk.

let onSessionExpired = null;

export function registerSessionExpiredHandler(fn) {
  onSessionExpired = typeof fn === "function" ? fn : null;
}

// -----------------------------------------------------------------------------
// Pagination
// -----------------------------------------------------------------------------

export const PAGE_SIZE = 10;
export const PAGE_SIZE_ALL = 1000;

export function withPage(path, { start = 0, offset = PAGE_SIZE } = {}) {
  const [base, existing = ""] = String(path).split("?");

  const params = new URLSearchParams(existing);

  params.set("start", String(start));
  params.set("offset", String(offset));

  return `${base}?${params.toString()}`;
}

// -----------------------------------------------------------------------------
// Error
// -----------------------------------------------------------------------------

export class ApiError extends Error {
  constructor({ code, message, status }) {
    super(message || "Request failed");

    this.name = "ApiError";
    this.code = code || "ERROR";
    this.status = status || 0;
  }
}

async function parseError(res) {
  let payload = null;

  try {
    payload = await res.json();
  } catch (_) {
    // Response wasn't JSON.
  }

  const err = payload?.error || payload || {};

  return new ApiError({
    code: err.code || `HTTP_${res.status}`,
    message: err.message || res.statusText || "Request failed",
    status: res.status,
  });
}

// -----------------------------------------------------------------------------
// Media URL
// -----------------------------------------------------------------------------

export function mediaUrl(path) {
  if (!path) return null;

  if (/^(data:|blob:|https?:)/i.test(path)) {
    return path;
  }

  return `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}

// -----------------------------------------------------------------------------
// Core request
// -----------------------------------------------------------------------------

export async function request(path, opts = {}) {
  const {
    method = "GET",
    body,
    isForm = false,
    auth = true,
    signal,
    raw = false,
  } = opts;

  const headers = {};

  // Normal API requests use Bearer JWT.
  //
  // NOTE:
  // This function is NOT used by HLS.js for .m3u8/.ts requests.
  // HLS authentication comes from the HttpOnly stream cookie.
  if (auth) {
    const token = getToken();

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  let payload = body;

  if (body != null && !isForm) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const url = `${API_BASE}${path}`;

  if (DEBUG) console.log(`[API] ${method} ${url}`);

  const res = await fetch(url, {
    method,
    headers,
    body: payload,
    signal,

    // IMPORTANT:
    // Allows the HttpOnly stream cookie to be sent/set on the same origin.
    credentials: "include",
  });

  if (!res.ok) {
    const err = await parseError(res);

    // Single-session rule: a replaced/expired session should sign the user out
    // cleanly rather than surfacing a raw 401 mid-app. We skip auth:false calls
    // (public endpoints) and let the logout call fail quietly on its own.
    if (
      auth &&
      res.status === 401 &&
      (err.code === "SESSION_REPLACED" || err.code === "UNAUTHORIZED")
    ) {
      clearToken();
      if (onSessionExpired) onSessionExpired(err);
    }

    throw err;
  }

  if (raw) {
    return res;
  }

  if (res.status === 204) {
    return null;
  }

  const text = await res.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (_) {
    return text;
  }
}

// -----------------------------------------------------------------------------
// API helpers
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// File upload (XHR) — gives a real upload % and precise errors, which fetch()
// can't. Same-origin (proxied) with credentials so the Bearer header is sent and
// the request behaves like every other API call. Used for video uploads.
// -----------------------------------------------------------------------------

export function uploadFile(path, formData, { onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE}${path}`;
    if (DEBUG) console.log(`[API] POST (xhr) ${url}`);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    // Same-origin — send the stream/session cookie too, harmless for uploads.
    xhr.withCredentials = true;
    const token = getToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    // NB: never set Content-Type for multipart — the browser adds the boundary.

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      let data = null;
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch (_) {
        data = xhr.responseText || null;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
        return;
      }

      const err = data?.error || {};
      if (
        xhr.status === 401 &&
        (err.code === "SESSION_REPLACED" || err.code === "UNAUTHORIZED")
      ) {
        clearToken();
        if (onSessionExpired) onSessionExpired(err);
      }

      reject(
        new ApiError({
          code: err.code || `HTTP_${xhr.status}`,
          message: err.message || `Upload failed (HTTP ${xhr.status})`,
          status: xhr.status,
        })
      );
    };

    xhr.onerror = () =>
      reject(
        new ApiError({
          code: "NETWORK_ERROR",
          message: "Upload could not reach the server. Check your connection.",
          status: 0,
        })
      );
    xhr.ontimeout = () =>
      reject(new ApiError({ code: "TIMEOUT", message: "Upload timed out.", status: 0 }));

    xhr.send(formData);
  });
}

// -----------------------------------------------------------------------------
// API helpers
// -----------------------------------------------------------------------------

export const api = {
  get: (path, opts) => request(path, { ...opts, method: "GET" }),

  post: (path, body, opts) => request(path, { ...opts, method: "POST", body }),

  put: (path, body, opts) => request(path, { ...opts, method: "PUT", body }),

  patch: (path, body, opts) => request(path, { ...opts, method: "PATCH", body }),

  del: (path, body, opts) => request(path, { ...opts, method: "DELETE", body }),

  form: (path, formData, opts = {}) =>
    request(path, {
      ...opts,
      method: opts.method || "POST",
      body: formData,
      isForm: true,
    }),

  // Progress-aware multipart upload (XHR).
  upload: (path, formData, opts) => uploadFile(path, formData, opts),
};
