/**
 * Upload history in Supabase (table: uploaded_pdfs). The live app keeps files
 * and the file list in GitHub; Supabase only stores a lightweight history log
 * (name, size, links, repo, date) so the owner can see what was uploaded when.
 *
 * Uses the service role key over the REST API. If SUPABASE_URL /
 * SUPABASE_SERVICE_ROLE_KEY are not set (e.g. Vercel env missing), recording
 * silently skips and listing reports "not configured" — uploads never fail
 * because of history.
 */

export interface HistoryRow {
  id: string;
  file_name: string;
  size_bytes: number;
  folder: string;
  repo: string;
  cdn_url: string;
  github_url: string;
  created_at: string;
}

const URL_VARS = ["SUPABASE_URL", "VITE_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"] as const;
const KEY_VARS = ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY", "SUPABASE_SECRET_KEY"] as const;

function firstEnv(names: readonly string[]): string | undefined {
  for (const n of names) {
    const v = process.env[n]?.trim();
    if (v) return v;
  }
  return undefined;
}

function config(): { url: string; key: string } | null {
  const url = firstEnv(URL_VARS);
  const key = firstEnv(KEY_VARS);
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key };
}

/** Human-readable reason when history is not configured (names the missing variable). */
export function historyConfigProblem(): string | null {
  const url = firstEnv(URL_VARS);
  const key = firstEnv(KEY_VARS);
  if (url && key) return null;
  const missing = [!url ? "SUPABASE_URL" : null, !key ? "SUPABASE_SERVICE_ROLE_KEY" : null].filter(Boolean).join(" aur ");
  const found = [url ? "SUPABASE_URL" : null, key ? "SUPABASE_SERVICE_ROLE_KEY" : null].filter(Boolean).join(", ");
  return `${missing} is site ke environment variables me set nahi hai${found ? ` (${found} mil gaya)` : ""} — Vercel → Settings → Environment Variables me add karke Redeploy karo.`;
}

/** Record uploaded files. Never throws — history must not break uploads. */
export async function recordUploads(
  repo: { owner: string; repo: string; branch: string } | undefined,
  entries: { name: string; path: string; size: number }[],
): Promise<void> {
  const cfg = config();
  if (!cfg || !repo || entries.length === 0) return;
  const spec = `${repo.owner}/${repo.repo}@${repo.branch}`;
  const rows = entries.map((e) => {
    const folder = e.path.includes("/") ? e.path.slice(0, e.path.lastIndexOf("/")) : "";
    return {
      file_name: e.name,
      size_bytes: e.size,
      folder,
      repo: spec,
      cdn_url: `https://cdn.jsdelivr.net/gh/${repo.owner}/${repo.repo}@${repo.branch}/${e.path}`,
      github_url: `https://github.com/${repo.owner}/${repo.repo}/blob/${repo.branch}/${e.path}`,
      uploaded_by: null,
    };
  });
  try {
    const res = await fetch(`${cfg.url}/rest/v1/uploaded_pdfs`, {
      method: "POST",
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        "content-type": "application/json",
        prefer: "return=minimal",
      },
      body: JSON.stringify(rows),
    });
    if (!res.ok) console.error("[history] insert failed", res.status, await res.text());
  } catch (err) {
    console.error("[history] insert error", err);
  }
}

/** Latest uploads, newest first. Throws if Supabase env is not configured. */
export async function listUploads(limit = 100): Promise<HistoryRow[]> {
  const cfg = config();
  if (!cfg) throw new Error(historyConfigProblem() ?? "Supabase env set nahi hai.");
  const res = await fetch(
    `${cfg.url}/rest/v1/uploaded_pdfs?select=id,file_name,size_bytes,folder,repo,cdn_url,github_url,created_at&order=created_at.desc&limit=${limit}`,
    { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` } },
  );
  if (!res.ok) throw new Error(`History padh nahi paaye (HTTP ${res.status}).`);
  return (await res.json()) as HistoryRow[];
}
