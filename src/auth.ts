// ---------------------------------------------------------------------------
// Who is logged in?
//
// In production, Cloudflare Access sits in front of the app and (after the
// person signs in with their company account) adds a trusted header with their
// verified email. We read that header.
//
// For local development there is no Access, so we allow a DEV_EMAIL value
// (set in the gitignored .dev.vars file) to pretend to be someone. In
// production DEV_EMAIL is not set, so only the real Access login works.
// ---------------------------------------------------------------------------

import type { Context } from "hono";
import { countUsers, getUser, upsertUser, type User } from "./db";
import type { Role } from "./data";

const ACCESS_EMAIL_HEADER = "Cf-Access-Authenticated-User-Email";

export function identityEmail(c: Context): string | null {
  const fromAccess = c.req.header(ACCESS_EMAIL_HEADER);
  if (fromAccess && fromAccess.includes("@")) return fromAccess.toLowerCase();
  const dev = (c.env as { DEV_EMAIL?: string }).DEV_EMAIL;
  if (dev && dev.includes("@")) return dev.toLowerCase();
  return null;
}

function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

// Find the user record for this email, creating one if needed:
//  - the very first person to sign in becomes the Admin (so nobody is locked out)
//  - anyone else new is added as a "viewer" until an admin gives them a role
export async function resolveUser(db: D1Database, email: string): Promise<User> {
  const existing = await getUser(db, email);
  if (existing) return existing;

  const isFirstEver = (await countUsers(db)) === 0;
  const role: Role = isFirstEver ? "admin" : "viewer";
  const name = nameFromEmail(email);
  await upsertUser(db, { email, name, role });
  return { email, name, role, createdAt: new Date().toISOString() };
}
