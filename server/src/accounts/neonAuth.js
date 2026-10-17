// Neon Auth (managed Better Auth) seen from our server.
//
// The browser never talks to Neon Auth directly: our /api/auth/* routes call
// it and pass its session cookies through, rewritten for our own domain
// (first-party cookies, so Safari / iPhone keep the session). The socket
// connection proves who it is with a short-lived JWT that we verify locally
// with Neon Auth's public keys (no network call per check).
import { createRemoteJWKSet, jwtVerify } from 'jose';

const COOKIE_PREFIX = '__Secure-neon-auth.';
const SESSION_COOKIE = `${COOKIE_PREFIX}session_token`;
const UPSTREAM_TIMEOUT_MS = 10_000;
const SESSION_CACHE_MS = 30_000;
const SESSION_CACHE_MAX = 500;

export function createNeonAuth(baseUrl) {
  const base = String(baseUrl).replace(/\/+$/, '');
  const issuer = new URL(base).origin;
  const jwks = createRemoteJWKSet(new URL(`${base}/.well-known/jwks.json`), {
    timeoutDuration: 8000,
    cooldownDuration: 30_000,
  });
  // session token → { user, at } (avoids one upstream call per API request)
  const sessionCache = new Map();

  // Only Neon Auth's own cookies are forwarded upstream
  function authCookies(cookieHeader) {
    if (!cookieHeader) return '';
    return cookieHeader
      .split(';')
      .map((c) => c.trim())
      .filter((c) => c.startsWith(COOKIE_PREFIX))
      .join('; ');
  }

  function sessionToken(cookieHeader) {
    const c = authCookies(cookieHeader).split('; ').find((x) => x.startsWith(`${SESSION_COOKIE}=`));
    return c ? c.slice(SESSION_COOKIE.length + 1) : null;
  }

  async function call(path, { method = 'GET', cookie = '', origin, body, query } = {}) {
    const url = new URL(`${base}/${path}`);
    if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
    const headers = { origin };
    const forwarded = authCookies(cookie);
    if (forwarded) headers.cookie = forwarded;
    if (body !== undefined) headers['content-type'] = 'application/json';
    const res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return {
      ok: res.ok,
      status: res.status,
      data,
      jwt: res.headers.get('set-auth-jwt'),
      // Rewritten for our domain: no Domain / Partitioned, SameSite=Lax
      cookies: res.headers.getSetCookie().map(rewriteSetCookie),
    };
  }

  /** The signed-in Neon Auth user of a request (null when signed out). */
  async function getSessionUser(cookieHeader, origin) {
    const token = sessionToken(cookieHeader);
    if (!token) return null;
    const hit = sessionCache.get(token);
    if (hit && Date.now() - hit.at < SESSION_CACHE_MS) return hit.user;
    const res = await call('get-session', { cookie: cookieHeader, origin });
    const user = res.ok && res.data && res.data.user ? res.data.user : null;
    if (sessionCache.size >= SESSION_CACHE_MAX) sessionCache.delete(sessionCache.keys().next().value);
    sessionCache.set(token, { user, at: Date.now() });
    return user;
  }

  function forgetSession(cookieHeader) {
    const token = sessionToken(cookieHeader);
    if (token) sessionCache.delete(token);
  }

  /** Verifies a Neon Auth JWT; returns { id, name, email } or null. */
  async function verifyToken(token) {
    if (typeof token !== 'string' || token.length < 20 || token.length > 4096) return null;
    try {
      const { payload } = await jwtVerify(token, jwks, { issuer, audience: issuer, algorithms: ['EdDSA'] });
      if (typeof payload.sub !== 'string' || !payload.sub) return null;
      if (payload.banned === true) return null;
      return {
        id: payload.sub,
        name: typeof payload.name === 'string' ? payload.name : '',
        email: typeof payload.email === 'string' ? payload.email : '',
      };
    } catch {
      return null;
    }
  }

  return { call, getSessionUser, forgetSession, verifyToken, sessionToken };
}

// "name=value; Max-Age=…; Path=/; HttpOnly; Secure; SameSite=None; Partitioned"
// → same cookie for our own domain, SameSite=Lax (sent on the OAuth return)
export function rewriteSetCookie(header) {
  const parts = header.split(';').map((p) => p.trim()).filter(Boolean);
  const [pair, ...attrs] = parts;
  const kept = attrs.filter((a) => !/^(domain|samesite|partitioned)(=|$)/i.test(a));
  if (!kept.some((a) => /^secure$/i.test(a))) kept.push('Secure');
  if (!kept.some((a) => /^path=/i.test(a))) kept.push('Path=/');
  kept.push('SameSite=Lax');
  return [pair, ...kept].join('; ');
}
