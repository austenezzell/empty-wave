/**
 * Admin session handling for the /admin editor.
 *
 * There is exactly one editor (the client), so this deliberately skips a user
 * table and an auth provider: a single shared password from the environment,
 * exchanged for an HMAC-signed, httpOnly cookie. Signing matters — an unsigned
 * "logged_in=true" cookie would be forgeable by anyone, and this cookie is the
 * only thing standing in front of the upload and delete actions.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "ew_admin";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function sessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("Missing ADMIN_SESSION_SECRET.");
  return secret;
}

/** Constant-time string compare that tolerates differing lengths. */
function safeEquals(a: string, b: string) {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

function signPayload(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("hex");
}

/** Check a submitted password against the configured one. */
export function passwordIsValid(submitted: string) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw new Error("Missing ADMIN_PASSWORD.");
  return safeEquals(submitted, expected);
}

/** Issue a signed session cookie. The payload is the expiry timestamp. */
export async function startSession() {
  const expiresAt = String(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, `${expiresAt}.${signPayload(expiresAt)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function endSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/** True when the request carries a valid, unexpired, correctly signed cookie. */
export async function isSignedIn() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (!raw) return false;

  const separator = raw.lastIndexOf(".");
  if (separator === -1) return false;

  const payload = raw.slice(0, separator);
  const signature = raw.slice(separator + 1);
  if (!safeEquals(signature, signPayload(payload))) return false;

  const expiresAt = Number(payload);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

/**
 * Guard for every mutating server action. Throwing here is the backstop that
 * makes the actions safe even though they compile to public endpoints.
 */
export async function requireAdmin() {
  if (!(await isSignedIn())) throw new Error("Not authorised.");
}
