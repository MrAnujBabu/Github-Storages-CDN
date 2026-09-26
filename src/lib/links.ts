import type { RepoRef } from "./storage-config";

/**
 * Link builders for a file stored in the GitHub repo.
 *
 * "pages" is GitHub Pages (https://{owner}.github.io/{repo}/{path}) and is the
 * default — it keeps working once the repo grows past jsDelivr's 50 MB cap.
 * "cdn" is the format the previous app handed out
 * (https://cdn.jsdelivr.net/gh/{owner}/{repo}@{branch}/{path}) and is still
 * available for old links. "cdn-pinned" points at a specific commit and never changes.
 */
export type LinkStyle = "cdn" | "cdn-pinned" | "pages" | "raw" | "statically" | "github" | "viewer";

export const ALL_LINK_STYLES: LinkStyle[] = ["cdn", "cdn-pinned", "pages", "raw", "statically", "github", "viewer"];

export interface LinkStyleInfo {
  id: LinkStyle;
  label: string;
  hint: string;
  /** Styles that can be chosen as the default "Copy link" target. */
  defaultable: boolean;
}

export const LINK_STYLES: LinkStyleInfo[] = [
  {
    id: "cdn",
    label: "CDN link",
    hint: "jsDelivr, fast worldwide. Purana format — poora repo 50 MB tak hi chalta hai.",
    defaultable: true,
  },
  {
    id: "cdn-pinned",
    label: "Permanent CDN link",
    hint: "Commit se bandha hua — kabhi nahi badlega, chahe file baad mein replace ho.",
    defaultable: true,
  },
  {
    id: "pages",
    label: "GitHub Pages link",
    hint: "GitHub ki apni hosting — repo bada (1 GB tak) ho tab bhi chalta hai. Naya file 1 minute mein live hota hai.",
    defaultable: true,
  },
  {
    id: "viewer",
    label: "Viewer link",
    hint: "Is app ka page — file naam ke saath khulti hai, mobile par bhi PDF dikhata hai.",
    defaultable: true,
  },
  {
    id: "raw",
    label: "Raw GitHub",
    hint: "Seedha GitHub se. PDF browser mein download ho sakti hai, inline nahi khulti.",
    defaultable: false,
  },
  {
    id: "statically",
    label: "Statically CDN",
    hint: "Doosra free CDN. 25 MB tak ki files.",
    defaultable: false,
  },
  {
    id: "github",
    label: "GitHub page",
    hint: "GitHub par file ka page.",
    defaultable: false,
  },
];

/**
 * Project-site URL for GitHub Pages; user/organisation sites live at the domain root.
 * The host keeps the owner's exact case — GitHub's Pages edge routes the hostname
 * case-sensitively, so an all-lowercase host can 404 even while the site is live.
 */
export function pagesBaseUrl(repo: RepoRef): string {
  const host = `${repo.owner}.github.io`;
  if (repo.repo.toLowerCase() === host.toLowerCase()) return `https://${host}`;
  return `https://${host}/${encodeURIComponent(repo.repo)}`;
}

export function encodePath(path: string): string {
  return path
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

export interface LinkContext {
  repo: RepoRef;
  /** Commit sha used for pinned links. */
  commit?: string | null | undefined;
  /** Origin of this app, for viewer links. */
  origin?: string | null | undefined;
}

export function buildLink(style: LinkStyle, path: string, ctx: LinkContext): string {
  const { owner, repo, branch } = ctx.repo;
  const p = encodePath(path);
  switch (style) {
    case "cdn":
      return `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${p}`;
    case "cdn-pinned": {
      const ref = ctx.commit ? ctx.commit.slice(0, 40) : branch;
      return `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${ref}/${p}`;
    }
    case "pages":
      return `${pagesBaseUrl(ctx.repo)}/${p}`;
    case "raw":
      return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${p}`;
    case "statically":
      return `https://cdn.statically.io/gh/${owner}/${repo}/${branch}/${p}`;
    case "github":
      return `https://github.com/${owner}/${repo}/blob/${branch}/${p}`;
    case "viewer": {
      const origin = ctx.origin ?? "";
      return `${origin}/v/${p}`;
    }
  }
}

export function purgeUrl(path: string, repo: RepoRef): string {
  return `https://purge.jsdelivr.net/gh/${repo.owner}/${repo.repo}@${repo.branch}/${encodePath(path)}`;
}

export function markdownLink(title: string, url: string): string {
  const safe = title.replace(/[[\]]/g, "");
  return `[${safe}](${url})`;
}

export function htmlEmbed(url: string, title: string): string {
  const safe = title.replace(/"/g, "&quot;");
  return `<iframe src="${url}" title="${safe}" width="100%" height="600" style="border:0"></iframe>`;
}

export function linkStyleInfo(style: LinkStyle): LinkStyleInfo {
  return LINK_STYLES.find((s) => s.id === style) ?? LINK_STYLES[0]!;
}

/** Default style first, everything else in catalogue order — the sheet shows the link people actually copy on top. */
export function orderedLinkStyles(defaultStyle: LinkStyle): LinkStyleInfo[] {
  const first = LINK_STYLES.find((s) => s.id === defaultStyle);
  return first ? [first, ...LINK_STYLES.filter((s) => s.id !== defaultStyle)] : LINK_STYLES;
}

/** Viewer deep link to one page of a PDF (`?page=N`). Page 1 stays the plain link. */
export function withPage(url: string, page: number | null | undefined): string {
  if (!page || page <= 1 || !Number.isFinite(page)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}page=${Math.floor(page)}`;
}

/** Parses `?page=` / `#page=` values; anything odd → undefined. */
export function parsePage(value: unknown): number | undefined {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number.parseInt(value, 10) : NaN;
  if (!Number.isFinite(n) || n < 1 || n > 100_000) return undefined;
  return Math.floor(n);
}

/**
 * Lovable preview / sandbox hosts need the owner's login, so a viewer link built
 * there is invisible to everyone else. Published `.lovable.app` sites and custom
 * domains are fine.
 */
export function isPreviewOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".lovableproject.com") ||
      host.startsWith("id-preview--") ||
      host.endsWith("-dev.lovable.app")
    );
  } catch {
    return false;
  }
}

/**
 * Normalises the owner-entered public address of this app: https(s) only, no
 * path/query, no trailing slash. Returns null when it cannot be a public origin.
 */
export function normalizeAppUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  let text = input.trim();
  if (!text) return null;
  if (!/^https?:\/\//i.test(text)) text = `https://${text}`;
  try {
    const u = new URL(text);
    const host = u.hostname.toLowerCase();
    if (!host || host === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[")) return null;
    if (!host.includes(".")) return null;
    return `${u.protocol}//${u.host}`.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

/* ------------------------------ link health ------------------------------ */

export type LinkHealthState = "ok" | "pending" | "blocked" | "down" | "preview" | "skipped";

export interface LinkHealth {
  style: LinkStyle;
  url: string;
  state: LinkHealthState;
  /** HTTP status when the request completed. */
  status: number | null;
  /** Round-trip time of the check in milliseconds. */
  ms: number;
  contentType: string | null;
}

/** Short Hinglish label + tone for one health result. */
export function describeHealth(h: LinkHealth): { text: string; tone: "ok" | "warn" | "bad" | "muted" } {
  switch (h.state) {
    case "ok":
      return { text: h.ms > 0 ? `Chal raha hai · ${h.ms} ms` : "Chal raha hai", tone: "ok" };
    case "pending":
      return {
        text: h.style === "pages" ? "Abhi live nahi — 1 minute me aa jayega" : "Abhi index nahi hua — thodi der me",
        tone: "warn",
      };
    case "blocked":
      return { text: h.style === "cdn" || h.style === "cdn-pinned" ? "Block — repo 50 MB se bada" : `Block (${h.status})`, tone: "bad" };
    case "down":
      return { text: h.status ? `Nahi khula (${h.status})` : "Jawab nahi aaya", tone: "bad" };
    case "preview":
      return { text: "Preview link — sirf aapko khulega", tone: "warn" };
    case "skipped":
    default:
      return { text: "Check nahi hua", tone: "muted" };
  }
}
