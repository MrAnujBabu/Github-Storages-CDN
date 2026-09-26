import { purgeUrl } from "./links";
import type { RepoRef } from "./storage-config";

/**
 * jsDelivr caches branch (@main) URLs for a while after a change, so after
 * uploads, renames and deletes we purge the exact paths — links then reflect
 * the repo within seconds instead of whenever the cache expires.
 *
 * Purging is best-effort: failures are logged but never block the user's
 * action (the commit already happened). Callers must `await` this so the
 * Worker does not drop the requests once the response is sent.
 */
const MAX_PURGE_PATHS = 500;
const CONCURRENCY = 5;

export async function purgeCdnPaths(repo: RepoRef, paths: string[]): Promise<{ purged: number; failed: number; skipped: number }> {
  const unique = [...new Set(paths.filter(Boolean))];
  const batch = unique.slice(0, MAX_PURGE_PATHS);
  const skipped = unique.length - batch.length;
  if (skipped > 0) {
    console.warn(`[cdn] purge list truncated: ${skipped} of ${unique.length} paths skipped (cache will expire on its own)`);
  }

  let purged = 0;
  let failed = 0;
  let index = 0;
  const failures: string[] = [];

  const worker = async () => {
    while (index < batch.length) {
      const path = batch[index++]!;
      try {
        const res = await fetch(purgeUrl(path, repo), {
          method: "GET",
          headers: { "User-Agent": "naveen-bharat-files" },
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) purged++;
        else {
          failed++;
          if (failures.length < 5) failures.push(`${path} → ${res.status}`);
        }
      } catch (err) {
        failed++;
        if (failures.length < 5) failures.push(`${path} → ${err instanceof Error ? err.message : "error"}`);
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batch.length) }, worker));
  if (failed > 0) console.warn(`[cdn] purge: ${purged} ok, ${failed} failed`, failures);
  return { purged, failed, skipped };
}
