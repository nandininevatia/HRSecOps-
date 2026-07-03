// ---------------------------------------------------------------------------
// Identity: who is logged in? In production this comes from Cloudflare Access
// (the company login) via a trusted header. Locally, a DEV_EMAIL var can stand
// in. No identity => the app fails closed (sign-in required).
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
  return local.split(/[._-]+/).filter(Boolean).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

// First-ever signer becomes Admin; unknown signers become read-only Viewers.
export async function resolveUser(db: D1Database, email: string): Promise<User> {
  const existing = await getUser(db, email);
  if (existing) return existing;
  const role: Role = (await countUsers(db)) === 0 ? "admin" : "viewer";
  const name = nameFromEmail(email);
  await upsertUser(db, { email, name, role });
  return { email, name, role, createdAt: new Date().toISOString() };
}
