// Lightweight signed-cookie session (no external session store needed).
// The cookie value is base64(payload) + "." + HMAC-SHA256(payload, secret).
// This makes it tamper-evident: if a user edits the cookie in devtools to
// change their role, the signature won't match and the session is rejected.
import crypto from "node:crypto";

const SESSION_COOKIE = "chalui_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getEnv(key) {
  return (
    (import.meta.env && import.meta.env[key]) ||
    (typeof process !== "undefined" && process.env && process.env[key])
  );
}

function getSecret() {
  const secret = getEnv("SESSION_SECRET");
  if (!secret) {
    throw new Error(
      "SESSION_SECRET env var is not set. Generate one (e.g. `openssl rand -hex 32`) and set it in .env / Vercel env vars."
    );
  }
  return secret;
}

function sign(payload) {
  const secret = getSecret();
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSessionValue(data) {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function verifySessionValue(value) {
  if (!value || typeof value !== "string" || !value.includes(".")) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  // Constant-time comparison to avoid timing attacks
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
  } catch {
    return null;
  }
}

export function setSessionCookie(cookies, data) {
  cookies.set(SESSION_COOKIE, createSessionValue(data), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(cookies) {
  cookies.delete(SESSION_COOKIE, { path: "/" });
}

export function getSession(cookies) {
  const raw = cookies.get(SESSION_COOKIE)?.value;
  return verifySessionValue(raw);
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
