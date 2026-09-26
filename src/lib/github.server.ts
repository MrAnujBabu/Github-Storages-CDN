import type { RepoRef } from "./storage-config";

/**
 * Minimal GitHub REST client for the storage repo.
 *
 * Transport is chosen from the environment inside each call:
 *  - Lovable GitHub connector (gateway) when GITHUB_API_KEY + LOVABLE_API_KEY exist
 *  - a plain token (GITHUB_TOKEN) against api.github.com
 *  - unauthenticated api.github.com as a last resort (public repos, 60 req/h)
 */

export class GitHubError extends Error {
  status: number;
  body: string;
  constructor(status: number, message: string, body = "") {
    super(message);
    this.name = "GitHubError";
    this.status = status;
    this.body = body;
  }
}

type Transport =
  | { kind: "gateway"; base: string; headers: Record<string, string> }
  | { kind: "direct"; base: string; headers: Record<string, string> };

function transport(): Transport {
  const gatewayKey = process.env["GITHUB_API_KEY"];
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const common = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "naveen-bharat-files",
  };
  if (gatewayKey && lovableKey) {
    return {
      kind: "gateway",
      base: "https://connector-gateway.lovable.dev/github",
      headers: {
        ...common,
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": gatewayKey,
      },
    };
  }
  const token = process.env["GITHUB_TOKEN"];
  return {
    kind: "direct",
    base: "https://api.github.com",
    headers: token ? { ...common, Authorization: `Bearer ${token}` } : common,
  };
}

export function isGitHubConfigured(): boolean {
  return Boolean(
    (process.env["GITHUB_API_KEY"] && process.env["LOVABLE_API_KEY"]) || process.env["GITHUB_TOKEN"],
  );
}

function friendlyMessage(status: number, body: string): string {
  let apiMessage = "";
  try {
    const parsed = JSON.parse(body) as { message?: string };
    apiMessage = parsed.message ?? "";
  } catch {
    apiMessage = body.slice(0, 200);
  }
  switch (status) {
    case 401:
      return "GitHub ne access mana kar diya — connection dobara jodni padegi.";
    case 403:
      return apiMessage.toLowerCase().includes("rate limit")
        ? "GitHub ki request limit poori ho gayi — thodi der baad dobara try karo."
        : "GitHub ne permission nahi di — token mein repo access hona chahiye.";
    case 404:
      return "Repo ya file GitHub par nahi mili.";
    case 409:
      return "Repo abhi-abhi kisi aur badlav se update hua — dobara try karo.";
    case 422:
      return apiMessage || "GitHub ne request accept nahi ki.";
    default:
      return apiMessage || `GitHub se jawab nahi mila (${status}).`;
  }
}

function send(t: Transport, path: string, init: RequestInit): Promise<Response> {
  const url = `${t.base}/${path.replace(/^\//, "")}`;
  const headers = new Headers(init.headers);
  for (const [k, v] of Object.entries(t.headers)) if (!headers.has(k)) headers.set(k, v);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(url, { ...init, headers });
}

export async function ghFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const t = transport();
  const res = await send(t, path, init);
  // Public reads must never break: if the connector credential is stale, read the public repo directly.
  const method = (init.method ?? "GET").toUpperCase();
  if (t.kind === "gateway" && res.status === 401 && method === "GET") {
    console.warn(`[github] gateway 401 on ${path}; falling back to direct read`);
    const token = process.env["GITHUB_TOKEN"];
    const { Authorization: _a, "X-Connection-Api-Key": _k, ...common } = t.headers;
    return send(
      { kind: "direct", base: "https://api.github.com", headers: token ? { ...common, Authorization: `Bearer ${token}` } : common },
      path,
      init,
    );
  }
  return res;
}

export async function ghJson<T>(path: string, init: RequestInit = {}, attempt = 0): Promise<T> {
  const res = await ghFetch(path, init);
  if (!res.ok) {
    const body = await res.text();
    // Secondary rate limit (bursts of content-creation calls): honour Retry-After once, up to 20s.
    const retryAfter = Number(res.headers.get("retry-after"));
    const secondary = (res.status === 403 || res.status === 429) && /rate limit|abuse/i.test(body);
    if (secondary && attempt < 1) {
      const waitMs = Math.min(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 3000, 20_000);
      console.warn(`[github] secondary rate limit on ${path}; retrying in ${waitMs}ms`);
      await new Promise((r) => setTimeout(r, waitMs));
      return ghJson<T>(path, init, attempt + 1);
    }
    console.error(`[github] ${init.method ?? "GET"} ${path} -> ${res.status}: ${body.slice(0, 300)}`);
    throw new GitHubError(res.status, friendlyMessage(res.status, body), body);
  }
  return (await res.json()) as T;
}

function repoPath(repo: RepoRef, suffix: string): string {
  return `repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/${suffix}`;
}

export interface TreeEntry {
  path: string;
  mode: string;
  type: "blob" | "tree" | "commit";
  sha: string;
  size?: number;
}

export interface RepoInfo {
  full_name: string;
  private: boolean;
  default_branch: string;
  size: number;
  html_url: string;
  pushed_at: string;
  permissions?: { push?: boolean; admin?: boolean };
}

export async function getRepoInfo(repo: RepoRef): Promise<RepoInfo> {
  return ghJson<RepoInfo>(repoPath(repo, ""));
}

/* ------------------------------ GitHub Pages ------------------------------ */

export interface PagesInfo {
  enabled: boolean;
  /** null | "queued" | "building" | "built" | "errored" */
  status: string | null;
  url: string | null;
  sourceBranch: string | null;
  sourcePath: string | null;
}

/** Pages site for the repo, or enabled:false when none exists (404). */
export async function getPagesInfo(repo: RepoRef): Promise<PagesInfo> {
  try {
    const data = await ghJson<{
      status: string | null;
      html_url: string | null;
      source?: { branch?: string; path?: string } | null;
    }>(repoPath(repo, "pages").replace(/\/$/, ""));
    return {
      enabled: true,
      status: data.status ?? null,
      url: data.html_url ?? null,
      sourceBranch: data.source?.branch ?? null,
      sourcePath: data.source?.path ?? null,
    };
  } catch (err) {
    if (err instanceof GitHubError && err.status === 404) {
      return { enabled: false, status: null, url: null, sourceBranch: null, sourcePath: null };
    }
    throw err;
  }
}

/** Turns on GitHub Pages from the storage branch root (idempotent: 409 = already on). */
export async function createPagesSite(repo: RepoRef): Promise<PagesInfo> {
  try {
    await ghJson(repoPath(repo, "pages"), {
      method: "POST",
      body: JSON.stringify({ build_type: "legacy", source: { branch: repo.branch, path: "/" } }),
    });
  } catch (err) {
    if (!(err instanceof GitHubError && err.status === 409)) throw err;
  }
  return getPagesInfo(repo);
}

/** Asks Pages to rebuild now (after enabling, or when a deploy looks stuck). Best effort. */
export async function requestPagesBuild(repo: RepoRef): Promise<void> {
  try {
    await ghJson(repoPath(repo, "pages/builds"), { method: "POST" });
  } catch (err) {
    console.warn("[pages] build request failed", err instanceof Error ? err.message : err);
  }
}

export async function getBranchHead(repo: RepoRef): Promise<{ commitSha: string; treeSha: string }> {
  const data = await ghJson<{ commit: { sha: string; commit: { tree: { sha: string } } } }>(
    repoPath(repo, `branches/${encodeURIComponent(repo.branch)}`),
  );
  return { commitSha: data.commit.sha, treeSha: data.commit.commit.tree.sha };
}

async function fetchTree(repo: RepoRef, sha: string, recursive: boolean) {
  const q = recursive ? "?recursive=1" : "";
  return ghJson<{ sha: string; tree: TreeEntry[]; truncated: boolean }>(repoPath(repo, `git/trees/${sha}${q}`));
}

/**
 * Full recursive tree. GitHub truncates very large trees (>100k entries or
 * >7MB); when that happens we walk sub-trees one level at a time.
 */
export async function getFullTree(repo: RepoRef, treeSha: string): Promise<TreeEntry[]> {
  const first = await fetchTree(repo, treeSha, true);
  if (!first.truncated) return first.tree;

  const out: TreeEntry[] = [];
  const walk = async (sha: string, prefix: string): Promise<void> => {
    const level = await fetchTree(repo, sha, false);
    for (const e of level.tree) {
      const full = prefix ? `${prefix}/${e.path}` : e.path;
      out.push({ ...e, path: full });
      if (e.type === "tree") await walk(e.sha, full);
    }
  };
  await walk(treeSha, "");
  return out;
}

export async function getBlobText(repo: RepoRef, sha: string): Promise<string> {
  const data = await ghJson<{ content: string; encoding: string }>(repoPath(repo, `git/blobs/${sha}`));
  if (data.encoding === "base64") {
    return Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf8");
  }
  return data.content;
}

export async function createBlob(repo: RepoRef, base64Content: string): Promise<string> {
  const data = await ghJson<{ sha: string }>(repoPath(repo, "git/blobs"), {
    method: "POST",
    body: JSON.stringify({ content: base64Content, encoding: "base64" }),
  });
  return data.sha;
}

export interface TreeChange {
  path: string;
  /** base64 file content to upload (creates a blob) */
  content?: string;
  /** existing blob sha to place at this path; null deletes the path */
  sha?: string | null;
}

/**
 * Applies a set of path changes as ONE commit on the branch using the Git
 * Data API. Moves reuse blob shas (no re-upload); deletes use sha: null.
 * Retries once when the branch moved underneath us.
 */
export async function commitChanges(
  repo: RepoRef,
  changes: TreeChange[],
  message: string,
): Promise<{ commitSha: string; treeSha: string }> {
  if (changes.length === 0) throw new GitHubError(400, "Koi badlav nahi mila.");

  // Upload new blobs first (sequentially — GitHub throttles bursts of writes).
  const entries: Array<{ path: string; mode: "100644"; type: "blob"; sha: string | null }> = [];
  for (const c of changes) {
    if (c.content !== undefined) {
      const sha = await createBlob(repo, c.content);
      entries.push({ path: c.path, mode: "100644", type: "blob", sha });
    } else {
      entries.push({ path: c.path, mode: "100644", type: "blob", sha: c.sha ?? null });
    }
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const head = await getBranchHead(repo);
      const tree = await ghJson<{ sha: string }>(repoPath(repo, "git/trees"), {
        method: "POST",
        body: JSON.stringify({ base_tree: head.treeSha, tree: entries }),
      });
      const commit = await ghJson<{ sha: string }>(repoPath(repo, "git/commits"), {
        method: "POST",
        body: JSON.stringify({ message, tree: tree.sha, parents: [head.commitSha] }),
      });
      await ghJson(repoPath(repo, `git/refs/heads/${encodeURIComponent(repo.branch)}`), {
        method: "PATCH",
        body: JSON.stringify({ sha: commit.sha, force: false }),
      });
      return { commitSha: commit.sha, treeSha: tree.sha };
    } catch (err) {
      lastError = err;
      const status = err instanceof GitHubError ? err.status : 0;
      if (status !== 409 && status !== 422) throw err;
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw lastError;
}
