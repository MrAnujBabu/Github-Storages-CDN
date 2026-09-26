import { type LinkHealth, type LinkStyle, buildLink, normalizeAppUrl } from "./links";
import type { RepoRef } from "./storage-config";

/**
 * Live health check for every link format of one file. Runs on the server so
 * hosts without CORS headers (github.com) can be probed too, and so the answer
 * is the same one a stranger on another network would get.
 */

const EXTERNAL_STYLES: LinkStyle[] = ["pages", "cdn", "cdn-pinned", "raw", "statically", "github"];
const TIMEOUT_MS = 7_000;
const CACHE_TTL_MS = 45_000;
const UA = "NaveenBharatFiles-LinkCheck/1.0 (+https://github.com)";

const cache = new Map<string, { at: number; result: LinkHealth[] }>();

async function probe(url: string): Promise<{ status: number | null; ms: number; contentType: string | null }> {
  const started = Date.now();
  const attempt = async (method: "HEAD" | "GET") => {
    const res = await fetch(url, {
      method,
      redirect: "follow",
      headers: method === "GET" ? { "user-agent": UA, range: "bytes=0-0" } : { "user-agent": UA },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // Drain tiny GET bodies so the connection can be reused; HEAD has none.
    if (method === "GET") await res.arrayBuffer().catch(() => undefined);
    return res;
  };
  try {
    let res = await attempt("HEAD");
    // Some edges refuse HEAD; a 1-byte ranged GET answers the same question.
    if (res.status === 405 || res.status === 501) res = await attempt("GET");
    return { status: res.status, ms: Date.now() - started, contentType: res.headers.get("content-type") };
  } catch {
    return { status: null, ms: Date.now() - started, contentType: null };
  }
}

function classify(style: LinkStyle, status: number | null): LinkHealth["state"] {
  if (status === null) return "down";
  if (status >= 200 && status < 400) return "ok";
  if (status === 404) {
    // Pages needs a build after each commit; jsDelivr indexes new commits lazily.
    return style === "pages" || style === "cdn" || style === "cdn-pinned" ? "pending" : "down";
  }
  if (status === 403 || status === 429 || status === 451) return "blocked";
  return "down";
}

/**
 * The viewer link is only probed when the owner configured a public address:
 * probing an arbitrary caller-supplied origin from the server would be an SSRF hole.
 */
function viewerTarget(appUrl: string | undefined, path: string, repo: RepoRef, commit: string): string | null {
  const origin = normalizeAppUrl(appUrl);
  if (!origin || !origin.startsWith("https://")) return null;
  return buildLink("viewer", path, { repo, commit, origin });
}

export async function checkLinks(repo: RepoRef, commit: string, path: string, appUrl?: string): Promise<LinkHealth[]> {
  const key = `${repo.owner}/${repo.repo}@${commit}:${path}:${appUrl ?? ""}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.result;

  const ctx = { repo, commit };
  const targets: Array<{ style: LinkStyle; url: string }> = EXTERNAL_STYLES.map((style) => ({ style, url: buildLink(style, path, ctx) }));
  const viewer = viewerTarget(appUrl, path, repo, commit);

  const results = await Promise.all(
    targets.map(async ({ style, url }): Promise<LinkHealth> => {
      const r = await probe(url);
      return { style, url, state: classify(style, r.status), status: r.status, ms: r.ms, contentType: r.contentType };
    }),
  );

  if (viewer) {
    const r = await probe(viewer);
    results.push({
      style: "viewer",
      url: viewer,
      // A 401/403 from our own host means the address is still a private preview.
      state: r.status === 401 || r.status === 403 ? "preview" : classify("viewer", r.status),
      status: r.status,
      ms: r.ms,
      contentType: r.contentType,
    });
  } else {
    results.push({ style: "viewer", url: "", state: "skipped", status: null, ms: 0, contentType: null });
  }

  // Keep the map small: it only needs to absorb repeat opens of the same sheet.
  if (cache.size > 200) cache.clear();
  cache.set(key, { at: Date.now(), result: results });
  return results;
}
