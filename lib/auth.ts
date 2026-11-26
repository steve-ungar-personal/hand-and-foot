// Single shared password. A sign-in cookie holds an expiry time signed with SESSION_SECRET,
// so it can't be forged from the source code. Changing the password or secret signs everyone out.
import "server-only";
import { createHash, createHmac, timingSafeEqual } from "crypto";

export const COOKIE = "hf_session";
/** 400 days is the longest browsers keep a cookie. It is renewed every time the app is used. */
const MAX_AGE = 400 * 24 * 60 * 60;

/** "open" = local development with no password set. A live site missing a setting stays locked. */
export function authMode(): "on" | "open" | "misconfigured" {
  if (process.env.APP_PASSWORD && process.env.SESSION_SECRET) return "on";
  const unset = !process.env.APP_PASSWORD && !process.env.SESSION_SECRET;
  return unset && process.env.NODE_ENV === "development" ? "open" : "misconfigured";
}

const same = (a: string, b: string) =>
  timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

const sign = (expires: string) =>
  createHmac("sha256", process.env.SESSION_SECRET!)
    .update(JSON.stringify([expires, process.env.APP_PASSWORD]))
    .digest("base64url");

export const passwordMatches = (password: string) => same(password, process.env.APP_PASSWORD!);

export function validSession(token: string | undefined) {
  const [expires, signature] = token?.split(".") ?? [];
  return !!signature && Number(expires) > Date.now() && same(signature, sign(expires));
}

/** A fresh cookie lasting the full period from now. */
export function sessionCookie() {
  const expires = String(Date.now() + MAX_AGE * 1000);
  return {
    name: COOKIE,
    value: `${expires}.${sign(expires)}`,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: MAX_AGE,
  };
}
