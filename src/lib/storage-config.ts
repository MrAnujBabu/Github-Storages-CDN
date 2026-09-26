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

/** jsDelivr refuses files over 50 MB; keep a safety margin. */
export const MAX_FILE_BYTES = 48 * 1024 * 1024;

/**
 * jsDelivr serves a GitHub repo only while the whole repo (at that branch) is
 * under 50 MB — above that every /gh/ link answers "Package size exceeded".
 * Source: jsDelivr README "Restrictions". Warn early so the owner can switch
 * the default link to GitHub Pages before links break.
 */
export const CDN_PACKAGE_LIMIT_BYTES = 50 * 1024 * 1024;
export const CDN_PACKAGE_WARN_BYTES = 40 * 1024 * 1024;

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
