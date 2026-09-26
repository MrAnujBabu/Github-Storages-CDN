import { deleteCookie, getCookie, getRequestHeader, setCookie } from "@tanstack/react-start/server";

/**
 * Owner sessions: an HMAC-signed, httpOnly cookie minted after the passcode
 * check. Payload is tiny (issued-at + expiry). SESSION_SECRET is a generated
 * server secret; OWNER_PASSCODE is the secret the owner types to sign in.
 */

const COOKIE_NAME = "nb_owner";
const SESSION_DAYS = 30;

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

interface SessionPayload {
  v: 1;
  iat: number;
  exp: number;
}

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function fromB64url(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, "base64url"));
}

async function hmacKey(): Promise<CryptoKey> {
  const secret = process.env["SESSION_SECRET"];
  if (!secret) throw new AuthError("Session secret set nahi hai.", 500);
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const key = await hmacKey();
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(body)));
  return `${body}.${b64url(sig)}`;
}

export async function verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  try {
    const key = await hmacKey();
    const sigBytes = fromB64url(sig);
    const ok = await crypto.subtle.verify("HMAC", key, sigBytes.slice().buffer as ArrayBuffer, enc.encode(body));
    if (!ok) return null;
    const payload = JSON.parse(Buffer.from(fromB64url(body)).toString("utf8")) as SessionPayload;
    if (payload.v !== 1 || typeof payload.exp !== "number") return null;
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function setOwnerCookie(): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const token = await signSession({ v: 1, iat: now, exp: now + SESSION_DAYS * 86400 });
  setCookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    // Always Secure: the app is HTTPS-only in production and browsers treat
    // http://localhost as a secure context, so dev sign-in keeps working. Deciding
    // this from x-forwarded-proto would let a client downgrade the cookie.
    secure: true,
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export function clearOwnerCookie(): void {
  deleteCookie(COOKIE_NAME, { path: "/" });
}

export async function isOwner(): Promise<boolean> {
  const token = getCookie(COOKIE_NAME);
  return (await verifySession(token)) !== null;
}

/** Same check for raw Request objects (server routes). */
export async function isOwnerRequest(request: Request): Promise<boolean> {
  const header = request.headers.get("cookie") ?? "";
  const match = header
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!match) return false;
  return (await verifySession(decodeURIComponent(match.slice(COOKIE_NAME.length + 1)))) !== null;
}

export async function requireOwner(): Promise<void> {
  if (!(await isOwner())) throw new AuthError("Ye kaam sirf owner kar sakta hai — pehle sign in karo.");
}

/** Sign-in needs both the passcode and the cookie-signing secret; missing either shows the setup hint instead of a 500. */
export function isPasscodeConfigured(): boolean {
  return Boolean(process.env["OWNER_PASSCODE"] && process.env["SESSION_SECRET"]);
}

async function sha256(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(text)));
}

/** Constant-time passcode comparison (compares digests of equal length). */
export async function checkPasscode(input: string): Promise<boolean> {
  const expected = process.env["OWNER_PASSCODE"];
  if (!expected) return false;
  const [a, b] = await Promise.all([sha256(input), sha256(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

// --- tiny in-memory brute-force brake (per isolate, best effort) ---
const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 6;
const WINDOW_MS = 10 * 60 * 1000;

export function clientKey(): string {
  try {
    return (
      getRequestHeader("cf-connecting-ip") ||
      getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown"
    );
  } catch {
    return "unknown";
  }
}

export function checkAttempts(key: string): { blocked: boolean; retryInSec: number } {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || rec.until < now) return { blocked: false, retryInSec: 0 };
  if (rec.count >= MAX_ATTEMPTS) return { blocked: true, retryInSec: Math.ceil((rec.until - now) / 1000) };
  return { blocked: false, retryInSec: 0 };
}

export function recordFailure(key: string): void {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || rec.until < now) attempts.set(key, { count: 1, until: now + WINDOW_MS });
  else rec.count += 1;
}

export function clearFailures(key: string): void {
  attempts.delete(key);
}
