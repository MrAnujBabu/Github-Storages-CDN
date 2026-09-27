import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { z } from "zod";

import type {
  BrowseView,
  DeliveryHealth,
  FileDetail,
  FolderView,
  KindListing,
  LibraryStats,
  PagesInfo,
  SearchHit,
  SessionInfo,
  StorageRepoSummary,
} from "./library-types";
import { type LinkHealth, isPreviewOrigin, normalizeAppUrl } from "./links";
import type { ManifestSettings } from "./manifest";

/**
 * Server functions for the library. Reads are public (the repo is public
 * anyway). Writes go through `ownerOnly`, which checks the signed session
 * cookie minted by the passcode sign-in.
 */

const pathSchema = z.string().max(900).default("");
const nameSchema = z.string().min(1).max(200);
const linkStyleSchema = z.enum(["cdn", "cdn-pinned", "pages", "raw", "statically", "github", "viewer"]);

async function withStatus<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const status = (err as { status?: number })?.status;
    if (typeof status === "number" && status >= 400 && status < 600) setResponseStatus(status);
    throw err;
  }
}

const ownerOnly = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const { isOwner } = await import("./session.server");
  if (!(await isOwner())) {
    setResponseStatus(401);
    throw new Error("Ye kaam sirf owner kar sakta hai — pehle sign in karo.");
  }
  return next();
});

/* ------------------------------ reads ------------------------------ */

export const getFolder = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ path: pathSchema }).parse(input ?? {}))
  .handler(async ({ data }): Promise<FolderView> => {
    const { buildFolderView, loadSnapshot } = await import("./library.server");
    const { isOwner } = await import("./session.server");
    const [snapshot, owner] = await Promise.all([loadSnapshot(), isOwner()]);
    return withStatus(async () => buildFolderView(snapshot, data.path, owner));
  });

export const getFile = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ path: z.string().min(1).max(900) }).parse(input))
  .handler(async ({ data }): Promise<FileDetail | null> => {
    const { findFileDetail, loadSnapshot } = await import("./library.server");
    const { isOwner } = await import("./session.server");
    const [snapshot, owner] = await Promise.all([loadSnapshot(), isOwner()]);
    return findFileDetail(snapshot, data.path, owner);
  });

export const searchLibrary = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ q: z.string().max(120) }).parse(input))
  .handler(async ({ data }): Promise<SearchHit[]> => {
    const { loadSnapshot, searchSnapshot } = await import("./library.server");
    const { isOwner } = await import("./session.server");
    const [snapshot, owner] = await Promise.all([loadSnapshot(), isOwner()]);
    return searchSnapshot(snapshot, data.q, owner);
  });

export const getBrowse = createServerFn({ method: "GET" }).handler(async (): Promise<BrowseView> => {
  const { buildBrowse, loadSnapshot } = await import("./library.server");
  const { isOwner } = await import("./session.server");
  const [snapshot, owner] = await Promise.all([loadSnapshot(), isOwner()]);
  return withStatus(async () => buildBrowse(snapshot, owner));
});

export const getKindFiles = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z.object({ kind: z.enum(["pdf", "image", "doc", "sheet", "slides", "text", "other"]) }).parse(input),
  )
  .handler(async ({ data }): Promise<KindListing> => {
    const { kindListing, loadSnapshot } = await import("./library.server");
    const { isOwner } = await import("./session.server");
    const [snapshot, owner] = await Promise.all([loadSnapshot(), isOwner()]);
    return withStatus(async () => kindListing(snapshot, data.kind, owner));
  });

export const getAllFolders = createServerFn({ method: "GET" }).handler(async (): Promise<string[]> => {
  const { visibleFolderPaths, loadSnapshot } = await import("./library.server");
  const { isOwner } = await import("./session.server");
  const [snapshot, owner] = await Promise.all([loadSnapshot(), isOwner()]);
  return visibleFolderPaths(snapshot, owner);
});

export const getStats = createServerFn({ method: "GET" }).handler(async (): Promise<LibraryStats> => {
  const { libraryStats, loadSnapshot } = await import("./library.server");
  const { isOwner } = await import("./session.server");
  const [snapshot, owner] = await Promise.all([loadSnapshot(), isOwner()]);
  return libraryStats(snapshot, owner);
});

export const getSession = createServerFn({ method: "GET" }).handler(async (): Promise<SessionInfo> => {
  const { isOwner, isPasscodeConfigured } = await import("./session.server");
  const { isGitHubConfigured } = await import("./github.server");
  const { decryptToken } = await import("./owner-token.server");
  const { getRepoConfig, loadSnapshot, resolveActiveRepo } = await import("./library.server");
  await resolveActiveRepo();
  const signedIn = await isOwner();
  let defaultLinkStyle: SessionInfo["defaultLinkStyle"] = "pages";
  let appUrl: string | undefined;
  // A token saved by the owner in Settings counts too, even without env vars.
  let githubConfigured = isGitHubConfigured();
  try {
    const snapshot = await loadSnapshot();
    defaultLinkStyle = snapshot.manifest.settings.linkStyle;
    appUrl = snapshot.manifest.settings.appUrl;
    if (!githubConfigured && snapshot.manifest.ownerTokenEnc) {
      githubConfigured = decryptToken(snapshot.manifest.ownerTokenEnc) !== null;
    }
  } catch {
    // repo unreachable — the folder view reports the real error
  }
  return {
    signedIn,
    repo: getRepoConfig(),
    passcodeConfigured: isPasscodeConfigured(),
    githubConfigured,
    defaultLinkStyle,
    appUrl,
  };
});

/**
 * Probes every link format of one file from the server (HEAD requests) so the
 * link sheet can show "chal raha hai / abhi live nahi / block" per row.
 * Public like the other reads; results are cached server-side for ~45 s.
 */
export const checkFileLinks = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ path: z.string().min(1).max(900) }).parse(input))
  .handler(async ({ data }): Promise<LinkHealth[]> => {
    const { findFileDetail, loadSnapshot } = await import("./library.server");
    const { isOwner } = await import("./session.server");
    const { checkLinks } = await import("./linkcheck.server");
    const [snapshot, owner] = await Promise.all([loadSnapshot(), isOwner()]);
    const detail = findFileDetail(snapshot, data.path, owner);
    if (!detail) {
      setResponseStatus(404);
      throw new Error("Ye file library mein nahi mili.");
    }
    return checkLinks(detail.repo, detail.headSha, detail.file.path, detail.settings.appUrl, { owner });
  });

/**
 * Library-wide link status: a handful of real (never hidden) files probed on
 * GitHub Pages, jsDelivr, raw GitHub and Statically. Public like the other
 * reads — only fixed public hosts are contacted. Cached ~45 s per commit.
 */
export const getDeliveryHealth = createServerFn({ method: "GET" }).handler(async (): Promise<DeliveryHealth> => {
  const { loadSnapshot, sampleFiles } = await import("./library.server");
  const { checkDelivery } = await import("./linkcheck.server");
  const snapshot = await loadSnapshot();
  return checkDelivery(snapshot.repo, snapshot.headSha, sampleFiles(snapshot, 4));
});

/* ------------------------------ auth ------------------------------- */

export const signIn = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ passcode: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const s = await import("./session.server");
    if (!s.isPasscodeConfigured()) {
      setResponseStatus(503);
      throw new Error("Owner passcode abhi set nahi hua — project settings mein OWNER_PASSCODE add karo.");
    }
    const key = s.clientKey();
    const gate = s.checkAttempts(key);
    if (gate.blocked) {
      setResponseStatus(429);
      throw new Error(`Bahut baar galat passcode — ${Math.ceil(gate.retryInSec / 60)} minute baad try karo.`);
    }
    const ok = await s.checkPasscode(data.passcode);
    if (!ok) {
      s.recordFailure(key);
      // The in-memory attempt counter is per isolate (best effort on Workers), so a
      // fixed slow-down per wrong guess is the part that always applies.
      await new Promise((r) => setTimeout(r, 1200));
      setResponseStatus(401);
      throw new Error("Passcode galat hai — dobara dekh kar likho.");
    }
    s.clearFailures(key);
    await s.setOwnerCookie();
    return { ok: true };
  });

export const signOut = createServerFn({ method: "POST" }).handler(async (): Promise<{ ok: true }> => {
  const { clearOwnerCookie } = await import("./session.server");
  clearOwnerCookie();
  return { ok: true };
});

/* ----------------------------- writes ------------------------------ */

export const createFolder = createServerFn({ method: "POST" })
  .middleware([ownerOnly])
  .validator((input: unknown) => z.object({ parent: pathSchema, name: nameSchema }).parse(input))
  .handler(async ({ data }) => {
    const lib = await import("./library.server");
    return withStatus(() => lib.createFolder(data.parent, data.name));
  });

export const renameItem = createServerFn({ method: "POST" })
  .middleware([ownerOnly])
  .validator((input: unknown) => z.object({ path: z.string().min(1).max(900), newName: nameSchema }).parse(input))
  .handler(async ({ data }) => {
    const lib = await import("./library.server");
    const { parentPath, joinPath } = await import("./paths");
    const target = joinPath(parentPath(data.path), data.newName);
    return withStatus(() => lib.renameOrMove(data.path, target));
  });

export const moveItem = createServerFn({ method: "POST" })
  .middleware([ownerOnly])
  .validator((input: unknown) => z.object({ path: z.string().min(1).max(900), toFolder: pathSchema }).parse(input))
  .handler(async ({ data }) => {
    const lib = await import("./library.server");
    const { baseName, joinPath } = await import("./paths");
    const target = joinPath(data.toFolder, baseName(data.path));
    return withStatus(() => lib.renameOrMove(data.path, target));
  });

export const deleteItem = createServerFn({ method: "POST" })
  .middleware([ownerOnly])
  .validator((input: unknown) => z.object({ path: z.string().min(1).max(900) }).parse(input))
  .handler(async ({ data }) => {
    const lib = await import("./library.server");
    return withStatus(() => lib.deleteItem(data.path));
  });

export const saveOrder = createServerFn({ method: "POST" })
  .middleware([ownerOnly])
  .validator((input: unknown) =>
    z.object({ folder: pathSchema, names: z.array(z.string().max(200)).max(2000) }).parse(input),
  )
  .handler(async ({ data }) => {
    const lib = await import("./library.server");
    await withStatus(() => lib.saveOrder(data.folder, data.names));
    return { ok: true as const };
  });

export const saveLabel = createServerFn({ method: "POST" })
  .middleware([ownerOnly])
  .validator((input: unknown) =>
    z
      .object({
        path: z.string().min(1).max(900),
        title: z.string().max(120).optional(),
        note: z.string().max(400).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const lib = await import("./library.server");
    await withStatus(() => lib.saveLabel(data.path, { title: data.title, note: data.note }));
    return { ok: true as const };
  });

export const setHidden = createServerFn({ method: "POST" })
  .middleware([ownerOnly])
  .validator((input: unknown) => z.object({ path: z.string().min(1).max(900), hidden: z.boolean() }).parse(input))
  .handler(async ({ data }) => {
    const lib = await import("./library.server");
    await withStatus(() => lib.saveHidden(data.path, data.hidden));
    return { ok: true as const };
  });

export const updateSettings = createServerFn({ method: "POST" })
  .middleware([ownerOnly])
  .validator((input: unknown) =>
    z
      .object({
        linkStyle: linkStyleSchema.optional(),
        /** Public origin for viewer links; empty string clears it. */
        appUrl: z.string().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<ManifestSettings> => {
    const lib = await import("./library.server");
    const patch: Partial<ManifestSettings> = {};
    if (data.linkStyle) patch.linkStyle = data.linkStyle;
    if (data.appUrl !== undefined) {
      const trimmed = data.appUrl.trim();
      if (trimmed) {
        const clean = normalizeAppUrl(trimmed);
        if (!clean) {
          setResponseStatus(400);
          throw new Error("Address samajh nahi aaya — https://aapki-site.app jaisa poora address likho.");
        }
        if (isPreviewOrigin(clean)) {
          setResponseStatus(400);
          throw new Error("Ye preview address hai — bahar walon ko nahi khulega. Pehle Publish karo, phir published address yahan daalo.");
        }
        patch.appUrl = clean;
      } else {
        patch.appUrl = undefined;
      }
    }
    return withStatus(() => lib.saveSettings(patch));
  });

/* --------------------------- owner GitHub token --------------------------- */

const githubTokenSchema = z
  .string()
  .trim()
  .min(20)
  .max(255)
  .regex(/^gh[pousr]_[A-Za-z0-9_]+$|^github_pat_[A-Za-z0-9_]{20,}$/, "Ye GitHub token jaisa nahi lag raha — ghp_… ya github_pat_… se shuru hona chahiye.");

export const saveGithubToken = createServerFn({ method: "POST" })
  .middleware([ownerOnly])
  .validator((input: unknown) => z.object({ token: githubTokenSchema }).parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const lib = await import("./library.server");
    const { verifyTokenWriteAccess } = await import("./owner-token.server");
    const check = await verifyTokenWriteAccess(data.token, (await lib.resolveActiveRepo()));
    if (!check.ok) {
      setResponseStatus(400);
      throw new Error(check.message ?? "Token verify nahi hua.");
    }
    await withStatus(() => lib.saveOwnerToken(data.token));
    return { ok: true as const };
  });

export const clearGithubToken = createServerFn({ method: "POST" })
  .middleware([ownerOnly])
  .handler(async (): Promise<{ ok: true }> => {
    const lib = await import("./library.server");
    await withStatus(() => lib.clearOwnerToken());
    return { ok: true as const };
  });

export const getGithubTokenStatus = createServerFn({ method: "GET" })
  .middleware([ownerOnly])
  .handler(async (): Promise<{ source: "env" | "saved" | "none"; hasSessionSecret: boolean }> => {
    const lib = await import("./library.server");
    return lib.ownerTokenStatus();
  });

export const purgeCdn = createServerFn({ method: "POST" })
  .middleware([ownerOnly])
  .validator((input: unknown) => z.object({ paths: z.array(z.string().max(900)).max(300).optional() }).parse(input ?? {}))
  .handler(async ({ data }) => {
    const lib = await import("./library.server");
    if (data.paths && data.paths.length) {
      const { purgeCdnPaths } = await import("./cdn.server");
      return purgeCdnPaths((await lib.resolveActiveRepo()), data.paths);
    }
    return lib.purgeAll();
  });

export const refreshLibrary = createServerFn({ method: "POST" })
  .middleware([ownerOnly])
  .handler(async () => {
    const lib = await import("./library.server");
    lib.invalidateSnapshot();
    await lib.loadSnapshot({ fresh: true });
    return { ok: true as const };
  });

/* ----------------------------- GitHub Pages ----------------------------- */

export const getPagesStatus = createServerFn({ method: "GET" })
  .middleware([ownerOnly])
  .handler(async (): Promise<PagesInfo> => {
    const lib = await import("./library.server");
    return withStatus(() => lib.pagesStatus());
  });

export const enablePages = createServerFn({ method: "POST" })
  .middleware([ownerOnly])
  .handler(async (): Promise<PagesInfo> => {
    const lib = await import("./library.server");
    return withStatus(() => lib.enablePages());
  });

/* --------------------------- bulk (multi-select) --------------------------- */

const pathsSchema = z.array(z.string().min(1).max(900)).min(1).max(200);

export const deleteItems = createServerFn({ method: "POST" })
  .middleware([ownerOnly])
  .validator((input: unknown) => z.object({ paths: pathsSchema }).parse(input))
  .handler(async ({ data }) => {
    const lib = await import("./library.server");
    return withStatus(() => lib.deleteMany(data.paths));
  });

export const moveItems = createServerFn({ method: "POST" })
  .middleware([ownerOnly])
  .validator((input: unknown) => z.object({ paths: pathsSchema, toFolder: pathSchema }).parse(input))
  .handler(async ({ data }) => {
    const lib = await import("./library.server");
    return withStatus(() => lib.moveMany(data.paths, data.toFolder));
  });

/* ------------------------------ storage repos ------------------------------ */

const repoNameSchema = z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9._-]+$/, "Repo naam mein sirf English letters, number, - _ . chalenge.");

export const listRepos = createServerFn({ method: "GET" })
  .middleware([ownerOnly])
  .handler(async (): Promise<StorageRepoSummary[]> => {
    const lib = await import("./library.server");
    return withStatus(() => lib.listStorageRepos());
  });

export const createRepo = createServerFn({ method: "POST" })
  .middleware([ownerOnly])
  .validator((input: unknown) =>
    z.object({ name: repoNameSchema, description: z.string().max(300).optional(), isPrivate: z.boolean().default(false), makeActive: z.boolean().default(true) }).parse(input),
  )
  .handler(async ({ data }) => {
    const lib = await import("./library.server");
    return withStatus(() => lib.createStorageRepo(data));
  });

export const addRepo = createServerFn({ method: "POST" })
  .middleware([ownerOnly])
  .validator((input: unknown) =>
    z.object({ fullName: z.string().trim().regex(/^[\w.-]+\/[\w.-]+$/, "owner/repo likho"), branch: z.string().trim().max(100).default("main") }).parse(input),
  )
  .handler(async ({ data }) => {
    const lib = await import("./library.server");
    await withStatus(() => lib.addExistingStorageRepo(data.fullName, data.branch));
    return { ok: true as const };
  });

export const setActiveRepo = createServerFn({ method: "POST" })
  .middleware([ownerOnly])
  .validator((input: unknown) => z.object({ spec: z.string().max(250) }).parse(input))
  .handler(async ({ data }) => {
    const lib = await import("./library.server");
    await withStatus(() => lib.setActiveStorageRepo(data.spec));
    return { ok: true as const };
  });

/* ------------------------------ upload history ------------------------------ */

export interface UploadHistoryItem {
  id: string;
  file_name: string;
  size_bytes: number;
  folder: string;
  repo: string;
  cdn_url: string;
  github_url: string;
  created_at: string;
}

export const getUploadHistory = createServerFn({ method: "GET" })
  .middleware([ownerOnly])
  .handler(async (): Promise<UploadHistoryItem[]> => {
    const { listUploads } = await import("./history.server");
    return withStatus(() => listUploads(100));
  });
