import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { DEFAULT_REPO, MANIFEST_PATH, parseRepoSpec, type RepoRef } from "./storage-config";

/**
 * Owner-managed GitHub token.
 *
 * The owner can save/rotate the GitHub token from inside the app (Settings)
 * without touching server environment variables. It is stored AES-256-GCM
 * encrypted in the repo manifest — the manifest is committed to a PUBLIC
 * repo, so only ciphertext ever lands there. The encryption key is derived
 * from SESSION_SECRET, which never leaves the server. Env `GITHUB_TOKEN`
 * always wins when present.
 */

export interface TokenStatus {
  source: "env" | "saved" | "none";
  hasSessionSecret: boolean;
}

function repoRef(): RepoRef {
  return parseRepoSpec(process.env["STORAGE_REPO"]) ?? DEFAULT_REPO;
}

function tokenKey(): Buffer | null {
  const secret = process.env["SESSION_SECRET"];
  if (!secret) return null;
  return createHash("sha256").update(`${secret}:owner-github-token`).digest();
}

export function encryptToken(plain: string): string {
  const key = tokenKey();
  if (!key) throw new Error("SESSION_SECRET set nahi hai — pehle usse environment variables mein add karo.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${data.toString("base64url")}`;
}

export function decryptToken(blob: string): string | null {
  const key = tokenKey();
  if (!key) return null;
  const [ivS, tagS, dataS] = blob.split(".");
  if (!ivS || !tagS || !dataS) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivS, "base64url"));
    decipher.setAuthTag(Buffer.from(tagS, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(dataS, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null; // wrong SESSION_SECRET or tampered blob
  }
}

/* --------------------------- runtime token cache --------------------------- */

let runtimeToken: string | null = null;
let runtimeTokenAt = 0;
let loading: Promise<string | null> | null = null;
let overrideToken: string | null = null;
const RUNTIME_TTL_MS = 5 * 60_000;

/** Save-flow override: lets the very first token save commit with the new token itself. */
export function withTokenOverride<T>(token: string, fn: () => Promise<T>): Promise<T> {
  overrideToken = token;
  return fn().finally(() => {
    overrideToken = null;
  });
}

/** Sync escape hatch used by the transport in github.server.ts. */
export function currentOverride(): string | null {
  return overrideToken;
}

export function setRuntimeToken(token: string): void {
  runtimeToken = token;
  runtimeTokenAt = Date.now();
}

export function forgetRuntimeToken(): void {
  runtimeToken = null;
  runtimeTokenAt = 0;
}

/** Token for GitHub calls: env first, then the owner-saved one (cached 5 min). */
export async function resolveGithubToken(): Promise<string | undefined> {
  const env = process.env["GITHUB_TOKEN"];
  if (env) return env;
  if (runtimeToken && Date.now() - runtimeTokenAt < RUNTIME_TTL_MS) return runtimeToken;
  if (!loading) {
    loading = readSavedToken()
      .then((t) => {
        runtimeToken = t;
        runtimeTokenAt = Date.now();
        return t;
      })
      .catch(() => null)
      .finally(() => {
        loading = null;
      });
  }
  return (await loading) ?? undefined;
}

/**
 * Reads .library/manifest.json straight from GitHub's public contents API so
 * this module stays independent of github.server.ts (which imports us).
 */
async function readSavedToken(): Promise<string | null> {
  const repo = repoRef();
  const url = `https://api.github.com/repos/${repo.owner}/${repo.repo}/contents/${MANIFEST_PATH}?ref=${encodeURIComponent(repo.branch)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/vnd.github.raw", "User-Agent": "naveen-bharat-files" },
  });
  if (!res.ok) return null;
  try {
    const raw = (await res.json()) as { ownerTokenEnc?: unknown };
    if (typeof raw.ownerTokenEnc !== "string" || raw.ownerTokenEnc.length > 4000) return null;
    return decryptToken(raw.ownerTokenEnc);
  } catch {
    return null;
  }
}

export async function tokenStatus(): Promise<TokenStatus> {
  const hasSessionSecret = Boolean(process.env["SESSION_SECRET"]);
  if (process.env["GITHUB_TOKEN"]) return { source: "env", hasSessionSecret };
  const saved = await resolveGithubToken();
  return { source: saved ? "saved" : "none", hasSessionSecret };
}

/** Checks a candidate token can actually push to the storage repo before we save it. */
export async function verifyTokenWriteAccess(token: string, repo: RepoRef): Promise<{ ok: boolean; message?: string }> {
  let res: Response;
  try {
    res = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.repo}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "naveen-bharat-files",
      },
    });
  } catch {
    return { ok: false, message: "GitHub tak request nahi pahunchi — thodi der baad try karo." };
  }
  if (res.status === 401) return { ok: false, message: "Token galat ya expire ho gaya hai — naya bana kar dobara try karo." };
  if (res.status === 404) return { ok: false, message: "Is token ko is repo ka access nahi mila — Repository access mein edu-pdfs chuno." };
  if (!res.ok) return { ok: false, message: `GitHub ne jawab nahi diya (${res.status}) — thodi der baad try karo.` };
  const data = (await res.json()) as { permissions?: { push?: boolean } };
  if (!data.permissions?.push) return { ok: false, message: "Token sirf padh sakta hai — Permissions mein Contents: Read and write do." };
  return { ok: true };
}
