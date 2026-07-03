// ---------------------------------------------------------------------------
// Identity & login. Three ways a request can be authenticated, in order:
//   1) Cloudflare Access header (if you ever enable Access) - trusted.
//   2) A signed session cookie set after "Sign in with Google".
//   3) DEV_EMAIL (local development only).
// If none, the app redirects to /login. Google sign-in is restricted to the
// company domain (ALLOWED_DOMAIN, default gocomet.com). No card, fully free.
// ---------------------------------------------------------------------------

import type { Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { countUsers, getUser, upsertUser, type User } from "./db";
import type { Role } from "./data";

const ACCESS_EMAIL_HEADER = "Cf-Access-Authenticated-User-Email";
const SESSION_COOKIE = "ob_session";
const STATE_COOKIE = "ob_oauth_state";
const SESSION_DAYS = 7;

type AuthEnv = {
  DEV_EMAIL?: string;
  AUTH_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  ALLOWED_DOMAIN?: string;
};

export function googleConfigured(env: AuthEnv): boolean {
  return !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.AUTH_SECRET);
}
export function allowedDomain(env: AuthEnv): string {
  return (env.ALLOWED_DOMAIN || "gocomet.com").toLowerCase();
}

// ---- small crypto helpers (Web Crypto, available in Workers) ---------------
const enc = new TextEncoder();
function b64url(bytes: Uint8Array): string {
  let s = ""; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(str: string): string {
  const s = str.replace(/-/g, "+").replace(/_/g, "/");
  return atob(s + "=".repeat((4 - (s.length % 4)) % 4));
}
async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return b64url(new Uint8Array(sig));
}

// ---- session token (payload.signature) ------------------------------------
async function signSession(secret: string, email: string): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify({ e: email, x: Date.now() + SESSION_DAYS * 86400000 })));
  const sig = await hmac(secret, payload);
  return `${payload}.${sig}`;
}
async function verifySession(secret: string, token: string): Promise<string | null> {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  if ((await hmac(secret, payload)) !== sig) return null;
  try {
    const obj = JSON.parse(b64urlDecode(payload));
    if (typeof obj.x !== "number" || obj.x < Date.now()) return null;
    return typeof obj.e === "string" ? obj.e : null;
  } catch { return null; }
}

// ---- current identity for a request ----------------------------------------
export async function currentEmail(c: Context): Promise<string | null> {
  const fromAccess = c.req.header(ACCESS_EMAIL_HEADER);
  if (fromAccess && fromAccess.includes("@")) return fromAccess.toLowerCase();

  const env = c.env as AuthEnv;
  if (env.AUTH_SECRET) {
    const tok = getCookie(c, SESSION_COOKIE);
    if (tok) { const email = await verifySession(env.AUTH_SECRET, tok); if (email) return email.toLowerCase(); }
  }
  if (env.DEV_EMAIL && env.DEV_EMAIL.includes("@")) return env.DEV_EMAIL.toLowerCase();
  return null;
}

// ---- Google OAuth ----------------------------------------------------------
export function beginGoogleLogin(c: Context): Response {
  const env = c.env as AuthEnv;
  const origin = new URL(c.req.url).origin;
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
  setCookie(c, STATE_COOKIE, state, { httpOnly: true, secure: true, sameSite: "Lax", path: "/", maxAge: 600 });
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID!, redirect_uri: `${origin}/auth/callback`,
    response_type: "code", scope: "openid email profile", state,
    access_type: "online", prompt: "select_account", hd: allowedDomain(env),
  });
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

export async function handleGoogleCallback(c: Context): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const env = c.env as AuthEnv;
  const url = new URL(c.req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = getCookie(c, STATE_COOKIE);
  deleteCookie(c, STATE_COOKIE, { path: "/" });
  if (!code) return { ok: false, error: "No code returned from Google." };
  if (!state || state !== cookieState) return { ok: false, error: "State mismatch (please try again)." };

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: env.GOOGLE_CLIENT_ID!, client_secret: env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${url.origin}/auth/callback`, grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return { ok: false, error: `Google token exchange failed (${tokenRes.status}).` };
  const tok = (await tokenRes.json()) as { id_token?: string };
  if (!tok.id_token) return { ok: false, error: "No id_token from Google." };

  // The id_token came directly from Google over TLS, so we can trust its claims.
  const claims = JSON.parse(b64urlDecode(tok.id_token.split(".")[1] ?? "")) as {
    email?: string; email_verified?: boolean; hd?: string;
  };
  const email = (claims.email || "").toLowerCase();
  if (!email || claims.email_verified === false) return { ok: false, error: "Email not verified by Google." };

  const domain = allowedDomain(env);
  const existing = await getUser(c.env.DB, email);
  if (!email.endsWith("@" + domain) && !existing) {
    return { ok: false, error: `Only @${domain} accounts can sign in.` };
  }

  setCookie(c, SESSION_COOKIE, await signSession(env.AUTH_SECRET!, email), {
    httpOnly: true, secure: true, sameSite: "Lax", path: "/", maxAge: SESSION_DAYS * 86400,
  });
  return { ok: true, email };
}

export function logout(c: Context): void {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

// ---- user record -----------------------------------------------------------
function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local.split(/[._-]+/).filter(Boolean).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}
export async function resolveUser(db: D1Database, email: string): Promise<User> {
  const existing = await getUser(db, email);
  if (existing) return existing;
  const role: Role = (await countUsers(db)) === 0 ? "admin" : "viewer";
  const name = nameFromEmail(email);
  await upsertUser(db, { email, name, role });
  return { email, name, role, createdAt: new Date().toISOString() };
}
