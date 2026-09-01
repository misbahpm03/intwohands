/* ============================================================================
   Admin session. One password in an env var, exchanged for a signed cookie.
   No session store, no database — the cookie carries its own expiry and an
   HMAC of it, so a tampered or extended cookie fails verification.

   Covered by api/_auth.test.mjs  (npm test)
   ==========================================================================*/

import crypto from "node:crypto";

export const COOKIE = "ith_admin";
export const MAX_AGE = 60 * 60 * 24 * 30;        /* thirty days, in seconds */

const secret = () => process.env.ADMIN_SECRET || "";

/** `<expiresAtMs>.<hmac>` */
export function sign(expiresAt, key = secret()) {
  const payload = String(expiresAt);
  const mac = crypto.createHmac("sha256", key).update(payload).digest("base64url");
  return `${payload}.${mac}`;
}

/** True only for an untampered, unexpired cookie signed with this secret. */
export function verify(token, key = secret(), now = Date.now()) {
  if (!token || !key) return false;                /* no secret = fail closed */

  const dot = token.lastIndexOf(".");
  if (dot < 1) return false;

  const payload = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(
    crypto.createHmac("sha256", key).update(payload).digest("base64url")
  );

  if (given.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(given, expected)) return false;

  const expires = Number(payload);
  return Number.isFinite(expires) && expires > now;
}

export function readCookie(req, name = COOKIE) {
  const raw = req.headers?.cookie || "";
  for (const part of raw.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return "";
}

export function cookieHeader(token, { maxAge = MAX_AGE } = {}) {
  const bits = [
    `${COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ];
  /* `vercel dev` serves over plain http, so only demand Secure in production */
  if (process.env.VERCEL) bits.push("Secure");
  return bits.join("; ");
}

export function isAdmin(req) {
  return verify(readCookie(req));
}

/** Constant-time password check that doesn't leak the length by throwing. */
export function passwordMatches(given) {
  const want = process.env.ADMIN_PASSWORD || "";
  if (!want) return false;

  const a = Buffer.from(String(given ?? ""));
  const b = Buffer.from(want);
  const len = Math.max(a.length, b.length, 1);

  const pa = Buffer.alloc(len);
  const pb = Buffer.alloc(len);
  a.copy(pa);
  b.copy(pb);

  return crypto.timingSafeEqual(pa, pb) && a.length === b.length;
}

/** Vercel usually parses JSON for us; fall back to reading the stream. */
export async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return {}; } }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return {}; }
}
