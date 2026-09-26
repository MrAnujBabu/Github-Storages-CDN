/**
 * Browser-safe storage constants. The repo that files live in can be
 * overridden on the server with the STORAGE_REPO env var
 * ("owner/repo@branch"); see getRepoConfig() in library.server.ts.
 */

export interface RepoRef {
  owner: string;
  repo: string;
  branch: string;
}

export const DEFAULT_REPO: RepoRef = {
  owner: "MrAnujBabu",
  repo: "edu-pdfs",
  branch: "main",
};

/** Where the app keeps ordering, labels and settings inside the repo. */
export const MANIFEST_PATH = ".library/manifest.json";

/** Upload ceiling for a single file (Pages/Raw serve these fine). */
export const MAX_FILE_BYTES = 48 * 1024 * 1024;

/**
 * jsDelivr's documented GitHub restrictions: single files over 20 MB and
 * packages over 150 MB are unsupported by default, and its package API stops
 * listing this repo past a configured 50 MB ("Package size exceeded the
 * configured limit of 50 MB"). Verified Sep 26 2026: at ~145 MB the /gh/ file
 * URLs still return 200, so treat 50 MB as a warning threshold, not a hard
 * outage — GitHub Pages stays the reliable default.
 */
export const CDN_PACKAGE_LIMIT_BYTES = 50 * 1024 * 1024;
export const CDN_PACKAGE_WARN_BYTES = 40 * 1024 * 1024;
/** jsDelivr will not serve a single GitHub file larger than this. */
export const CDN_FILE_LIMIT_BYTES = 20 * 1024 * 1024;

/** GitHub Pages published-site soft limit. */
export const PAGES_SITE_LIMIT_BYTES = 1024 * 1024 * 1024;

/** Total bytes per multi-file upload request (Worker memory headroom; single files may use MAX_FILE_BYTES). */
export const MAX_BATCH_BYTES = 40 * 1024 * 1024;

/** Max files per single upload request. */
export const MAX_FILES_PER_UPLOAD = 20;

export const APP_NAME = "Naveen Bharat Files";
export const APP_TAGLINE = "Notes, PDFs aur images — GitHub par store, CDN se deliver.";

export function parseRepoSpec(spec: string | undefined | null): RepoRef | null {
  if (!spec) return null;
  const m = spec.trim().match(/^([\w.-]+)\/([\w.-]+)(?:@([\w./-]+))?$/);
  if (!m) return null;
  return { owner: m[1]!, repo: m[2]!, branch: m[3] || "main" };
}

export function repoLabel(repo: RepoRef): string {
  return `${repo.owner}/${repo.repo}`;
}
