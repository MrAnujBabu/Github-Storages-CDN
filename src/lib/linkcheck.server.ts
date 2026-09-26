import type { DeliveryChannel, DeliveryHealth } from "./library-types";
import { type LinkHealth, type LinkHealthState, type LinkStyle, buildLink, normalizeAppUrl } from "./links";
import { baseName } from "./paths";
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
 * Hosting platforms whose hostnames can only ever point at public edge servers.
 * An address on one of these is safe to probe for anonymous visitors too; any
 * other owner-entered address is probed only while the owner is signed in, so a
 * public visitor can never turn this into a server-side request against an
 * internal host (the app itself never accepts a caller-supplied address).
 */
const PUBLIC_EDGE_SUFFIXES = [".lovable.app", ".vercel.app", ".netlify.app", ".pages.dev", ".github.io", ".workers.dev"];

function isKnownPublicHost(origin: string): boolean {
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return PUBLIC_EDGE_SUFFIXES.some((suffix) => host.endsWith(suffix));
  } catch {
    return false;
  }
}

/**
 * The viewer link is only probed when the owner configured a public address:
 * probing an arbitrary caller-supplied origin from the server would be an SSRF hole.
 */
function viewerTarget(
  appUrl: string | undefined,
  path: string,
  repo: RepoRef,
  commit: string,
  owner: boolean,
): string | null {
  const origin = normalizeAppUrl(appUrl);
  if (!origin || !origin.startsWith("https://")) return null;
  if (!owner && !isKnownPublicHost(origin)) return null;
  return buildLink("viewer", path, { repo, commit, origin });
}

export async function checkLinks(
  repo: RepoRef,
  commit: string,
  path: string,
  appUrl?: string,
  opts: { owner?: boolean } = {},
): Promise<LinkHealth[]> {
  const owner = opts.owner === true;
  const key = `${repo.owner}/${repo.repo}@${commit}:${path}:${appUrl ?? ""}:${owner ? "o" : "v"}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.result;

  const ctx = { repo, commit };
  const targets: Array<{ style: LinkStyle; url: string }> = EXTERNAL_STYLES.map((style) => ({ style, url: buildLink(style, path, ctx) }));
  const viewer = viewerTarget(appUrl, path, repo, commit, owner);

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

/* --------------------------- library-wide check --------------------------- */

/** Channels that matter for sharing: the default (Pages), the old CDN, and the two fallbacks. */
const DELIVERY_STYLES: LinkStyle[] = ["pages", "cdn", "raw", "statically"];
const STATE_RANK: Record<LinkHealthState, number> = { ok: 0, skipped: 0, preview: 1, pending: 1, blocked: 2, down: 3 };

const deliveryCache = new Map<string, { at: number; result: DeliveryHealth }>();

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

function summarise(style: LinkStyle, results: LinkHealth[]): DeliveryChannel {
  const ok = results.filter((r) => r.state === "ok");
  let worst: LinkHealthState = "ok";
  for (const r of results) if (STATE_RANK[r.state] > STATE_RANK[worst]) worst = r.state;
  return {
    style,
    ok: ok.length,
    total: results.length,
    medianMs: median(ok.map((r) => r.ms)),
    state: results.length === 0 ? "skipped" : ok.length === results.length ? "ok" : worst,
  };
}

/**
 * Probes a few real files on every public channel and rolls the answers up per
 * channel — the "is my library reachable right now?" panel. Only fixed public
 * hosts are contacted, so this is safe to expose to visitors. Cached ~45 s per
 * commit; a new upload changes the commit and re-checks automatically.
 */
export async function checkDelivery(repo: RepoRef, commit: string, paths: string[]): Promise<DeliveryHealth> {
  const key = `${repo.owner}/${repo.repo}@${commit}:delivery:${paths.join("|")}`;
  const hit = deliveryCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.result;

  const ctx = { repo, commit };
  const samples = await Promise.all(
    paths.map(async (path) => {
      const results = await Promise.all(
        DELIVERY_STYLES.map(async (style): Promise<LinkHealth> => {
          const url = buildLink(style, path, ctx);
          const r = await probe(url);
          return { style, url, state: classify(style, r.status), status: r.status, ms: r.ms, contentType: r.contentType };
        }),
      );
      return { path, name: baseName(path), results };
    }),
  );

  const channels = DELIVERY_STYLES.map((style) =>
    summarise(
      style,
      samples.map((s) => s.results.find((r) => r.style === style)!).filter(Boolean),
    ),
  );

  const result: DeliveryHealth = { checkedAt: new Date().toISOString(), headSha: commit, samples, channels };
  if (deliveryCache.size > 50) deliveryCache.clear();
  deliveryCache.set(key, { at: Date.now(), result });
  return result;
}
