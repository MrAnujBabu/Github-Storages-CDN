import { purgeCdnPaths } from "./cdn.server";
import {
  GitHubError,
  commitChanges,
  createPagesSite,
  getBlobText,
  getBranchHead,
  getFullTree,
  getPagesInfo,
  requestPagesBuild,
  type PagesInfo,
  type TreeChange,
  type TreeEntry,
} from "./github.server";
import type {
  BrowseCategory,
  BrowseCollection,
  BrowseView,
  Crumb,
  FileDetail,
  FolderView,
  KindListing,
  LibraryFile,
  LibraryFolder,
  LibraryItem,
  LibraryStats,
  SearchHit,
  UploadedEntry,
} from "./library-types";
import {
  type ItemLabel,
  type Manifest,
  type ManifestSettings,
  isHiddenPath,
  parseManifest,
  removeFromManifest,
  renameInManifest,
  resolveAlias,
  serializeManifest,
  setHidden as setHiddenInManifest,
  setLabel as setLabelInManifest,
  setOrder,
  sortChildren,
} from "./manifest";
import {
  baseName,
  cleanFileName,
  type FileKind,
  cleanFolderName,
  extensionOf,
  fileKind,
  isHiddenEntry,
  isSafeName,
  isSafePath,
  joinPath,
  naturalCompare,
  normalizePath,
  parentPath,
} from "./paths";
import { ALLOWED_FILE_EXTS, DEFAULT_REPO, MANIFEST_PATH, MAX_FILE_BYTES, parseRepoSpec, type RepoRef } from "./storage-config";

/* ------------------------------------------------------------------ */
/* Config + snapshot                                                   */
/* ------------------------------------------------------------------ */

export function getRepoConfig(): RepoRef {
  return parseRepoSpec(process.env["STORAGE_REPO"]) ?? DEFAULT_REPO;
}

export class LibraryError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "LibraryError";
    this.status = status;
  }
}

export interface Snapshot {
  repo: RepoRef;
  headSha: string;
  treeSha: string;
  /** blobs only, excluding the manifest */
  files: TreeEntry[];
  manifest: Manifest;
  manifestSha: string | null;
  loadedAt: number;
}

const SNAPSHOT_TTL_MS = 20_000;
let cached: { key: string; at: number; promise: Promise<Snapshot> } | null = null;

async function fetchSnapshot(repo: RepoRef): Promise<Snapshot> {
  const head = await getBranchHead(repo);
  const tree = await getFullTree(repo, head.treeSha);
  const manifestEntry = tree.find((e) => e.type === "blob" && e.path === MANIFEST_PATH) ?? null;
  const manifestText = manifestEntry ? await getBlobText(repo, manifestEntry.sha) : null;
  const files = tree.filter((e) => e.type === "blob" && e.path !== MANIFEST_PATH);
  return {
    repo,
    headSha: head.commitSha,
    treeSha: head.treeSha,
    files,
    manifest: parseManifest(manifestText),
    manifestSha: manifestEntry?.sha ?? null,
    loadedAt: Date.now(),
  };
}

export async function loadSnapshot(opts: { fresh?: boolean } = {}): Promise<Snapshot> {
  const repo = getRepoConfig();
  const key = `${repo.owner}/${repo.repo}@${repo.branch}`;
  const now = Date.now();
  if (!opts.fresh && cached && cached.key === key && now - cached.at < SNAPSHOT_TTL_MS) {
    return cached.promise;
  }
  const promise = fetchSnapshot(repo).catch((err) => {
    if (cached?.promise === promise) cached = null;
    throw err;
  });
  cached = { key, at: now, promise };
  return promise;
}

export function invalidateSnapshot(): void {
  cached = null;
}

/* ------------------------------------------------------------------ */
/* Read models                                                         */
/* ------------------------------------------------------------------ */

function crumbsFor(path: string): Crumb[] {
  const crumbs: Crumb[] = [{ name: "Library", path: "" }];
  if (!path) return crumbs;
  const parts = path.split("/");
  parts.forEach((p, i) => crumbs.push({ name: p, path: parts.slice(0, i + 1).join("/") }));
  return crumbs;
}

function labelFor(m: Manifest, path: string): ItemLabel {
  return m.labels[path] ?? {};
}

/** Every folder path implied by the tree (git has no empty folders; .keep files count). */
export function allFolderPaths(snapshot: Snapshot): string[] {
  const set = new Set<string>();
  for (const f of snapshot.files) {
    let p = parentPath(f.path);
    while (p) {
      set.add(p);
      p = parentPath(p);
    }
  }
  return [...set].sort(naturalCompare);
}

function visibleFile(entry: TreeEntry): boolean {
  return !isHiddenEntry(baseName(entry.path)) && !entry.path.split("/").some((seg) => seg.startsWith("."));
}

export function buildFolderView(snapshot: Snapshot, rawPath: string, includeHidden: boolean): FolderView {
  const requested = normalizePath(rawPath);
  if (!isSafePath(requested)) throw new LibraryError("Folder ka naam theek nahi hai.", 400);
  const m = snapshot.manifest;
  // Old folder links keep working after a rename/move (same alias map files use).
  const livePrefix = requested + "/";
  const path =
    requested && !snapshot.files.some((e) => e.path.startsWith(livePrefix)) ? resolveAlias(m, requested) : requested;

  const prefix = path ? path + "/" : "";
  const childFiles = new Map<string, TreeEntry>();
  const childFolders = new Map<string, { files: number; folders: Set<string>; bytes: number; cover?: string }>();
  let exists = path === "";

  for (const entry of snapshot.files) {
    if (!entry.path.startsWith(prefix)) continue;
    exists = true;
    const rest = entry.path.slice(prefix.length);
    const slash = rest.indexOf("/");
    if (slash === -1) {
      if (visibleFile(entry)) childFiles.set(rest, entry);
      continue;
    }
    const folderName = rest.slice(0, slash);
    if (folderName.startsWith(".")) continue;
    const agg = childFolders.get(folderName) ?? { files: 0, folders: new Set<string>(), bytes: 0 };
    if (visibleFile(entry)) {
      agg.files += 1;
      agg.bytes += entry.size ?? 0;
      if (!agg.cover && fileKind(entry.path) === "image") agg.cover = entry.path;
    }
    const deeper = rest.slice(slash + 1);
    const nextSlash = deeper.indexOf("/");
    if (nextSlash !== -1) agg.folders.add(deeper.slice(0, nextSlash));
    childFolders.set(folderName, agg);
  }

  // Hidden folders behave as missing for visitors (files inside are hidden too via isHiddenPath).
  if (exists && !includeHidden && path && isHiddenPath(m, path)) exists = false;
  if (!exists) {
    // A folder may exist only through an alias (renamed) — resolve for callers.
    return {
      repo: snapshot.repo,
      path,
      exists: false,
      crumbs: crumbsFor(path),
      title: baseName(path) || "Library",
      hidden: false,
      items: [],
      customOrder: false,
      headSha: snapshot.headSha,
      settings: m.settings,
      totals: { files: 0, folders: 0, bytes: 0 },
      includesHidden: includeHidden,
    };
  }

  const order = m.order[path];
  const folderNames = sortChildren([...childFolders.keys()], order);
  const fileNames = sortChildren([...childFiles.keys()], order);

  const folders: LibraryFolder[] = folderNames.map((name) => {
    const agg = childFolders.get(name)!;
    const p = joinPath(path, name);
    const label = labelFor(m, p);
    return {
      type: "folder",
      name,
      path: p,
      fileCount: agg.files,
      folderCount: agg.folders.size,
      bytes: agg.bytes,
      cover: agg.cover,
      title: label.title,
      note: label.note,
      hidden: isHiddenPath(m, p),
    };
  });

  const files: LibraryFile[] = fileNames.map((name) => {
    const e = childFiles.get(name)!;
    const label = labelFor(m, e.path);
    return {
      type: "file",
      name,
      path: e.path,
      size: e.size ?? 0,
      sha: e.sha,
      kind: fileKind(name),
      title: label.title,
      note: label.note,
      hidden: isHiddenPath(m, e.path),
    };
  });

  const items: LibraryItem[] = [...folders, ...files].filter((i) => includeHidden || !i.hidden);
  const label = labelFor(m, path);
  const totals = items.reduce(
    (acc, i) => {
      if (i.type === "file") {
        acc.files += 1;
        acc.bytes += i.size;
      } else {
        acc.folders += 1;
      }
      return acc;
    },
    { files: 0, folders: 0, bytes: 0 },
  );

  return {
    repo: snapshot.repo,
    path,
    exists: true,
    crumbs: crumbsFor(path),
    title: label.title ?? (baseName(path) || "Library"),
    note: label.note,
    hidden: path ? isHiddenPath(m, path) : false,
    items,
    customOrder: Boolean(order && order.length),
    headSha: snapshot.headSha,
    settings: m.settings,
    totals,
    includesHidden: includeHidden,
  };
}

export function findFileDetail(snapshot: Snapshot, rawPath: string, includeHidden: boolean): FileDetail | null {
  const requested = normalizePath(rawPath);
  if (!isSafePath(requested)) return null;
  const m = snapshot.manifest;
  const path = resolveAlias(m, requested);
  const entry = snapshot.files.find((e) => e.path === path);
  if (!entry || !visibleFile(entry)) return null;
  if (!includeHidden && isHiddenPath(m, path)) return null;

  const folder = parentPath(path);
  const view = buildFolderView(snapshot, folder, includeHidden);
  const files = view.items.filter((i): i is LibraryFile => i.type === "file");
  const idx = files.findIndex((f) => f.path === path);
  const label = labelFor(m, path);

  return {
    repo: snapshot.repo,
    requestedPath: requested,
    file: {
      type: "file",
      name: baseName(path),
      path,
      size: entry.size ?? 0,
      sha: entry.sha,
      kind: fileKind(path),
      title: label.title,
      note: label.note,
      hidden: isHiddenPath(m, path),
    },
    headSha: snapshot.headSha,
    settings: m.settings,
    crumbs: crumbsFor(folder),
    prev: idx > 0 ? { name: files[idx - 1]!.name, path: files[idx - 1]!.path } : null,
    next: idx >= 0 && idx < files.length - 1 ? { name: files[idx + 1]!.name, path: files[idx + 1]!.path } : null,
  };
}

export function searchSnapshot(snapshot: Snapshot, query: string, includeHidden: boolean, limit = 60): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  const m = snapshot.manifest;
  const hits: Array<{ hit: SearchHit; score: number }> = [];
  for (const e of snapshot.files) {
    if (!visibleFile(e)) continue;
    if (!includeHidden && isHiddenPath(m, e.path)) continue;
    const label = labelFor(m, e.path);
    const name = baseName(e.path);
    const hay = `${name} ${label.title ?? ""} ${label.note ?? ""} ${parentPath(e.path)}`.toLowerCase();
    if (!terms.every((t) => hay.includes(t))) continue;
    let score = 0;
    const lname = name.toLowerCase();
    if (lname.startsWith(q)) score += 3;
    if (lname.includes(q)) score += 2;
    if ((label.title ?? "").toLowerCase().includes(q)) score += 2;
    hits.push({
      score,
      hit: {
        folder: parentPath(e.path),
        file: {
          type: "file",
          name,
          path: e.path,
          size: e.size ?? 0,
          sha: e.sha,
          kind: fileKind(name),
          title: label.title,
          note: label.note,
          hidden: isHiddenPath(m, e.path),
        },
      },
    });
  }
  return hits
    .sort((a, b) => b.score - a.score || naturalCompare(a.hit.file.name, b.hit.file.name))
    .slice(0, limit)
    .map((h) => h.hit);
}

/** Folder paths a caller may see: visitors never get hidden or dot folders. */
export function visibleFolderPaths(snapshot: Snapshot, includeHidden: boolean): string[] {
  const all = allFolderPaths(snapshot);
  if (includeHidden) return all;
  return all.filter(
    (p) => !p.split("/").some((seg) => seg.startsWith(".")) && !isHiddenPath(snapshot.manifest, p),
  );
}

/**
 * A small, spread-out sample of public files for the library-wide link check:
 * one file per top-level folder (root files count as one group), up to `limit`.
 * Hidden files are never sampled — the result is shown to visitors too.
 */
export function sampleFiles(snapshot: Snapshot, limit = 4): string[] {
  const groups = new Map<string, TreeEntry>();
  const candidates = snapshot.files
    .filter((e) => visibleFile(e) && !isHiddenPath(snapshot.manifest, e.path))
    .sort((a, b) => naturalCompare(a.path, b.path));
  for (const e of candidates) {
    const top = e.path.includes("/") ? e.path.slice(0, e.path.indexOf("/")) : "";
    const current = groups.get(top);
    // Prefer PDFs (the library's main content), then the smaller file.
    const better =
      !current ||
      (fileKind(e.path) === "pdf" && fileKind(current.path) !== "pdf") ||
      (fileKind(e.path) === fileKind(current.path) && (e.size ?? 0) < (current.size ?? 0));
    if (better) groups.set(top, e);
  }
  const picked = [...groups.values()].slice(0, limit).map((e) => e.path);
  // Tiny libraries: top up with any remaining files so the check still has substance.
  if (picked.length < limit) {
    for (const e of candidates) {
      if (picked.length >= limit) break;
      if (!picked.includes(e.path)) picked.push(e.path);
    }
  }
  return picked;
}

export function libraryStats(snapshot: Snapshot, includeHidden = false): LibraryStats {
  const byKind: Record<string, number> = {};
  let files = 0;
  let bytes = 0;
  const shown = (e: TreeEntry) => visibleFile(e) && (includeHidden || !isHiddenPath(snapshot.manifest, e.path));
  for (const e of snapshot.files) {
    if (!shown(e)) continue;
    files += 1;
    bytes += e.size ?? 0;
    const k = fileKind(e.path);
    byKind[k] = (byKind[k] ?? 0) + 1;
  }
  const largest = snapshot.files
    .filter(shown)
    .sort((a, b) => (b.size ?? 0) - (a.size ?? 0))
    .slice(0, 5)
    .map((e) => ({ path: e.path, size: e.size ?? 0 }));
  return { files, folders: visibleFolderPaths(snapshot, includeHidden).length, bytes, byKind, largest };
}

/* ------------------------------------------------------------------ */
/* Write operations (owner only — callers must check the session)      */
/* ------------------------------------------------------------------ */

function manifestChange(m: Manifest): TreeChange {
  return { path: MANIFEST_PATH, content: Buffer.from(serializeManifest(m), "utf8").toString("base64") };
}

async function commit(snapshot: Snapshot, changes: TreeChange[], message: string) {
  try {
    const result = await commitChanges(snapshot.repo, changes, message);
    invalidateSnapshot();
    return result;
  } catch (err) {
    invalidateSnapshot();
    if (err instanceof GitHubError) throw new LibraryError(err.message, err.status >= 500 ? 502 : err.status);
    throw err;
  }
}

function filesUnder(snapshot: Snapshot, path: string): TreeEntry[] {
  return snapshot.files.filter((e) => e.path === path || e.path.startsWith(path + "/"));
}

function assertFolderPath(path: string): string {
  const p = normalizePath(path);
  if (!isSafePath(p)) throw new LibraryError("Folder path theek nahi hai.");
  return p;
}

/**
 * Existing path that would collide with `target`, compared case-insensitively.
 * Git keeps "Notes.pdf" and "notes.pdf" apart, but phones, Windows and the CDN
 * cache do not — so we refuse the second one. `ignoreUnder` excludes the item
 * being renamed (a case-only rename of itself is fine).
 */
function caseClash(snapshot: Snapshot, target: string, ignoreUnder?: string): string | null {
  const t = target.toLowerCase();
  const skip = ignoreUnder?.toLowerCase();
  for (const e of snapshot.files) {
    const p = e.path.toLowerCase();
    if (skip && (p === skip || p.startsWith(skip + "/"))) continue;
    if (p === t || p.startsWith(t + "/")) return e.path;
  }
  return null;
}

/**
 * Git drops a folder the moment its last blob goes, so after deletes/moves we
 * put back a `.keep` in every folder that just became empty (but is not itself
 * being removed). The owner then still sees "Ye folder abhi khaali hai" instead
 * of the folder silently vanishing.
 */
function keepEmptiedFolders(snapshot: Snapshot, changes: TreeChange[], removedRoots: string[]): TreeChange[] {
  const remaining = new Set(snapshot.files.map((e) => e.path));
  const candidates = new Set<string>();
  for (const c of changes) {
    const isDelete = c.content === undefined && c.sha === null;
    if (isDelete) {
      remaining.delete(c.path);
      const parent = parentPath(c.path);
      if (parent) candidates.add(parent);
    } else {
      remaining.add(c.path);
    }
  }
  for (const root of removedRoots) {
    const parent = parentPath(root);
    if (parent) candidates.add(parent);
  }
  const extra: TreeChange[] = [];
  for (const folder of candidates) {
    if (removedRoots.some((r) => folder === r || folder.startsWith(r + "/"))) continue;
    let stillHas = false;
    for (const p of remaining) {
      if (p.startsWith(folder + "/")) {
        stillHas = true;
        break;
      }
    }
    if (!stillHas) {
      const keep = `${folder}/.keep`;
      extra.push({ path: keep, content: "" });
      remaining.add(keep);
    }
  }
  return extra;
}

export async function createFolder(parent: string, rawName: string): Promise<{ path: string }> {
  const parentClean = assertFolderPath(parent);
  const name = cleanFolderName(rawName);
  if (!name || !isSafeName(name)) throw new LibraryError("Folder ka naam theek nahi hai.");
  const snapshot = await loadSnapshot({ fresh: true });
  const path = joinPath(parentClean, name);
  const clash = caseClash(snapshot, path);
  if (clash) {
    const sameCase = clash === path || clash.startsWith(path + "/");
    throw new LibraryError(
      sameCase ? "Is naam ka folder pehle se hai." : `"${baseName(clash.split("/").slice(0, path.split("/").length).join("/"))}" naam pehle se hai (bas letters ka case alag) — koi aur naam do.`,
      409,
    );
  }
  await commit(snapshot, [{ path: `${path}/.keep`, content: "" }], `Create folder ${path}`);
  return { path };
}

export interface IncomingFile {
  name: string;
  base64: string;
  size: number;
}

export async function uploadFiles(
  folder: string,
  incoming: IncomingFile[],
): Promise<{ commitSha: string; uploaded: UploadedEntry[] }> {
  const folderClean = assertFolderPath(folder);
  if (incoming.length === 0) throw new LibraryError("Koi file nahi mili.");
  for (const f of incoming) {
    if (!isSafeName(f.name)) throw new LibraryError(`"${f.name}" ka naam theek nahi hai.`);
    if (f.size > MAX_FILE_BYTES) throw new LibraryError(`"${f.name}" 48 MB se badi hai — CDN itni badi file serve nahi karta.`, 413);
  }
  const snapshot = await loadSnapshot({ fresh: true });
  const changes: TreeChange[] = [];
  const uploaded: UploadedEntry[] = [];
  const purge: string[] = [];
  const seen = new Set<string>();
  for (const f of incoming) {
    const path = joinPath(folderClean, f.name);
    const lower = path.toLowerCase();
    if (seen.has(lower)) throw new LibraryError(`"${f.name}" do baar chuni gayi hai (bas letters ka case alag) — ek rakho.`);
    seen.add(lower);
    const replaced = snapshot.files.some((e) => e.path === path);
    if (!replaced) {
      const clash = caseClash(snapshot, path);
      if (clash) {
        throw new LibraryError(`"${baseName(clash)}" naam ki file pehle se hai (bas letters ka case alag) — pehle use rename ya delete karo.`, 409);
      }
    }
    changes.push({ path, content: f.base64 });
    uploaded.push({ name: f.name, path, size: f.size, replaced });
    if (replaced) purge.push(path);
  }
  // A folder created through the app has a .keep placeholder; drop it once real files arrive.
  const keep = folderClean ? `${folderClean}/.keep` : null;
  if (keep && snapshot.files.some((e) => e.path === keep)) changes.push({ path: keep, sha: null });

  const label = uploaded.length === 1 ? `Upload ${uploaded[0]!.name}` : `Upload ${uploaded.length} files to ${folderClean || "root"}`;
  const result = await commit(snapshot, changes, label);
  // Awaited on purpose: a detached promise may be dropped once the Worker response is sent.
  if (purge.length) await purgeCdnPaths(snapshot.repo, purge);
  return { commitSha: result.commitSha, uploaded };
}

export interface IncomingBlob {
  name: string;
  size: number;
  /** Sha of a blob the browser already pushed straight to GitHub. */
  blobSha: string;
}

/**
 * Same as uploadFiles, but the file bytes never pass through this server —
 * the browser created GitHub blobs directly (avoids the ~4.5 MB serverless
 * request-body limit that made large files fail with HTTP 413). Here we only
 * place the existing blob shas into the tree and commit.
 */
export async function uploadBlobFiles(
  folder: string,
  incoming: IncomingBlob[],
): Promise<{ commitSha: string; uploaded: UploadedEntry[] }> {
  const folderClean = assertFolderPath(folder);
  if (incoming.length === 0) throw new LibraryError("Koi file nahi mili.");
  for (const f of incoming) {
    if (!isSafeName(f.name)) throw new LibraryError(`"${f.name}" ka naam theek nahi hai.`);
    if (f.size > MAX_FILE_BYTES) throw new LibraryError(`"${f.name}" 48 MB se badi hai — CDN itni badi file serve nahi karta.`, 413);
  }
  const snapshot = await loadSnapshot({ fresh: true });
  const changes: TreeChange[] = [];
  const uploaded: UploadedEntry[] = [];
  const purge: string[] = [];
  const seen = new Set<string>();
  for (const f of incoming) {
    const path = joinPath(folderClean, f.name);
    const lower = path.toLowerCase();
    if (seen.has(lower)) throw new LibraryError(`"${f.name}" do baar chuni gayi hai (bas letters ka case alag) — ek rakho.`);
    seen.add(lower);
    const replaced = snapshot.files.some((e) => e.path === path);
    if (!replaced) {
      const clash = caseClash(snapshot, path);
      if (clash) {
        throw new LibraryError(`"${baseName(clash)}" naam ki file pehle se hai (bas letters ka case alag) — pehle use rename ya delete karo.`, 409);
      }
    }
    changes.push({ path, sha: f.blobSha });
    uploaded.push({ name: f.name, path, size: f.size, replaced });
    if (replaced) purge.push(path);
  }
  // A folder created through the app has a .keep placeholder; drop it once real files arrive.
  const keep = folderClean ? `${folderClean}/.keep` : null;
  if (keep && snapshot.files.some((e) => e.path === keep)) changes.push({ path: keep, sha: null });

  const label = uploaded.length === 1 ? `Upload ${uploaded[0]!.name}` : `Upload ${uploaded.length} files to ${folderClean || "root"}`;
  const result = await commit(snapshot, changes, label);
  if (purge.length) await purgeCdnPaths(snapshot.repo, purge);
  return { commitSha: result.commitSha, uploaded };
}

export async function renameOrMove(path: string, target: string): Promise<{ from: string; to: string }> {
  const from = normalizePath(path);
  // The last segment is user-typed: strip characters that break URLs, same as uploads do.
  const rawTo = normalizePath(target);
  const to = joinPath(parentPath(rawTo), cleanFileName(baseName(rawTo)));
  if (!isSafePath(from) || !from) throw new LibraryError("Item ka path theek nahi hai.");
  if (!isSafePath(to) || !to || !isSafeName(baseName(to))) throw new LibraryError("Naya naam theek nahi hai.");
  if (from === to) return { from, to };
  if (to.startsWith(from + "/")) throw new LibraryError("Folder ko khud ke andar nahi le ja sakte.");

  const snapshot = await loadSnapshot({ fresh: true });
  const affected = filesUnder(snapshot, from);
  if (affected.length === 0) throw new LibraryError("Ye item ab repo mein nahi hai.", 404);
  const isFolder = !(affected.length === 1 && affected[0]!.path === from);

  // Renaming a file must not bypass the upload type check: without this,
  // notes.pdf → notes.html would turn GitHub Pages into a host for arbitrary
  // web pages (scripts included) on the library's own domain.
  if (!isFolder) {
    const ext = extensionOf(to);
    if (!ALLOWED_FILE_EXTS.has(ext)) {
      throw new LibraryError(`".${ext || "bin"}" type ki file library mein nahi rakhi ja sakti — PDF, photo, doc, sheet ya slides hi allowed hain.`, 415);
    }
  }

  const clash = caseClash(snapshot, to, from);
  if (clash) {
    const exact = clash === to || clash.startsWith(to + "/");
    throw new LibraryError(
      exact ? "Is naam se pehle se kuch maujood hai." : `"${baseName(to)}" jaisa naam pehle se hai (bas letters ka case alag) — koi aur naam do.`,
      409,
    );
  }

  const changes: TreeChange[] = [];
  const purge: string[] = [];
  for (const e of affected) {
    const newPath = e.path === from ? to : to + e.path.slice(from.length);
    changes.push({ path: e.path, sha: null });
    changes.push({ path: newPath, sha: e.sha });
    // Purge both sides: the old URL must die, and the new URL may hold a
    // cached 404 from someone guessing the name earlier.
    purge.push(e.path, newPath);
  }
  const manifest = renameInManifest(snapshot.manifest, from, to);
  changes.push(manifestChange(manifest));
  changes.push(...keepEmptiedFolders(snapshot, changes, isFolder ? [from] : []));
  await commit(snapshot, changes, `${isFolder ? "Move folder" : "Rename"} ${from} -> ${to}`);
  await purgeCdnPaths(snapshot.repo, purge);
  return { from, to };
}

export async function deleteItem(path: string): Promise<{ deleted: number }> {
  const p = normalizePath(path);
  if (!isSafePath(p) || !p) throw new LibraryError("Item ka path theek nahi hai.");
  const snapshot = await loadSnapshot({ fresh: true });
  const affected = filesUnder(snapshot, p);
  if (affected.length === 0) throw new LibraryError("Ye item ab repo mein nahi hai.", 404);
  const isFolder = !(affected.length === 1 && affected[0]!.path === p);
  const changes: TreeChange[] = affected.map((e) => ({ path: e.path, sha: null }));
  const manifest = removeFromManifest(snapshot.manifest, p);
  changes.push(manifestChange(manifest));
  changes.push(...keepEmptiedFolders(snapshot, changes, isFolder ? [p] : []));
  await commit(snapshot, changes, `Delete ${p}`);
  await purgeCdnPaths(
    snapshot.repo,
    affected.map((e) => e.path),
  );
  return { deleted: affected.filter((e) => visibleFile(e)).length };
}

export async function saveOrder(folder: string, names: string[]): Promise<void> {
  const f = assertFolderPath(folder);
  const cleanNames = [...new Set(names.filter((n) => typeof n === "string" && isSafeName(n)))].slice(0, 2000);
  const snapshot = await loadSnapshot({ fresh: true });
  const manifest = setOrder(snapshot.manifest, f, cleanNames);
  await commit(snapshot, [manifestChange(manifest)], `Arrange ${f || "root"}`);
}

export async function saveLabel(path: string, label: ItemLabel): Promise<void> {
  const p = normalizePath(path);
  if (!isSafePath(p) || !p) throw new LibraryError("Item ka path theek nahi hai.");
  const snapshot = await loadSnapshot({ fresh: true });
  const manifest = setLabelInManifest(snapshot.manifest, p, label);
  await commit(snapshot, [manifestChange(manifest)], `Label ${p}`);
}

export async function saveHidden(path: string, hidden: boolean): Promise<void> {
  const p = normalizePath(path);
  if (!isSafePath(p) || !p) throw new LibraryError("Item ka path theek nahi hai.");
  const snapshot = await loadSnapshot({ fresh: true });
  const manifest = setHiddenInManifest(snapshot.manifest, p, hidden);
  await commit(snapshot, [manifestChange(manifest)], `${hidden ? "Hide" : "Show"} ${p}`);
}

export async function saveSettings(settings: Partial<ManifestSettings>): Promise<ManifestSettings> {
  const snapshot = await loadSnapshot({ fresh: true });
  const next: ManifestSettings = { ...snapshot.manifest.settings, ...settings };
  const manifest: Manifest = { ...snapshot.manifest, settings: next };
  await commit(snapshot, [manifestChange(manifest)], "Update library settings");
  return next;
}

/* ------------------------ owner GitHub token (encrypted) ------------------------ */

/**
 * Saves the owner's GitHub token encrypted in the manifest. The runtime token
 * is set BEFORE the commit so the very first save (no env token yet) can push
 * with the new token itself via the save-flow override.
 */
export async function saveOwnerToken(token: string): Promise<void> {
  const { encryptToken, setRuntimeToken, withTokenOverride } = await import("./owner-token.server");
  setRuntimeToken(token);
  const snapshot = await loadSnapshot({ fresh: true });
  const manifest: Manifest = { ...snapshot.manifest, ownerTokenEnc: encryptToken(token) };
  await withTokenOverride(token, () => commit(snapshot, [manifestChange(manifest)], "Update GitHub access"));
}

/** Removes the saved token. Uses the still-valid saved token to push the removal. */
export async function clearOwnerToken(): Promise<void> {
  const { forgetRuntimeToken, resolveGithubToken, withTokenOverride } = await import("./owner-token.server");
  const current = await resolveGithubToken();
  forgetRuntimeToken();
  const snapshot = await loadSnapshot({ fresh: true });
  const manifest: Manifest = { ...snapshot.manifest, ownerTokenEnc: undefined };
  const change = manifestChange(manifest);
  if (current) await withTokenOverride(current, () => commit(snapshot, [change], "Remove saved GitHub access"));
  else await commit(snapshot, [change], "Remove saved GitHub access");
}

export async function ownerTokenStatus(): Promise<{ source: "env" | "saved" | "none"; hasSessionSecret: boolean }> {
  const { tokenStatus } = await import("./owner-token.server");
  return tokenStatus();
}

export async function purgeAll(): Promise<{ purged: number; failed: number }> {
  const snapshot = await loadSnapshot();
  return purgeCdnPaths(
    snapshot.repo,
    snapshot.files.filter(visibleFile).map((e) => e.path),
  );
}

/* ----------------------------- bulk actions ----------------------------- */

/** Normalise, validate and de-duplicate a selection; nested picks collapse into their parent. */
function cleanSelection(paths: string[]): string[] {
  const clean = [...new Set(paths.map((p) => normalizePath(p)).filter((p) => p && isSafePath(p)))];
  if (clean.length === 0) throw new LibraryError("Kuch select nahi hua.");
  return clean.filter((p) => !clean.some((q) => q !== p && p.startsWith(q + "/")));
}

/** Delete many files/folders in ONE commit (so history stays tidy and the CDN purge runs once). */
export async function deleteMany(paths: string[]): Promise<{ deleted: number; items: number }> {
  const targets = cleanSelection(paths);
  const snapshot = await loadSnapshot({ fresh: true });
  const changes: TreeChange[] = [];
  const purge: string[] = [];
  const removedFolders: string[] = [];
  let manifest = snapshot.manifest;
  let items = 0;
  for (const p of targets) {
    const affected = filesUnder(snapshot, p);
    if (affected.length === 0) continue; // already gone — not an error in a bulk action
    items++;
    if (!(affected.length === 1 && affected[0]!.path === p)) removedFolders.push(p);
    for (const e of affected) {
      changes.push({ path: e.path, sha: null });
      if (visibleFile(e)) purge.push(e.path);
    }
    manifest = removeFromManifest(manifest, p);
  }
  if (items === 0) throw new LibraryError("Ye items ab repo mein nahi hain.", 404);
  changes.push(manifestChange(manifest));
  changes.push(...keepEmptiedFolders(snapshot, changes, removedFolders));
  await commit(snapshot, changes, items === 1 ? `Delete ${targets[0]}` : `Delete ${items} items`);
  await purgeCdnPaths(snapshot.repo, purge);
  return { deleted: purge.length, items };
}

/** Move many files/folders into one folder in ONE commit. Skips items already there. */
export async function moveMany(paths: string[], toFolder: string): Promise<{ moved: number; skipped: number }> {
  const targets = cleanSelection(paths);
  const dest = assertFolderPath(toFolder);
  const snapshot = await loadSnapshot({ fresh: true });
  const changes: TreeChange[] = [];
  const purge: string[] = [];
  const movedFolders: string[] = [];
  const taken = new Set(snapshot.files.map((e) => e.path));
  let manifest = snapshot.manifest;
  let moved = 0;
  let skipped = 0;

  for (const from of targets) {
    const to = joinPath(dest, baseName(from));
    if (from === to) {
      skipped++;
      continue;
    }
    if (dest === from || dest.startsWith(from + "/")) {
      skipped++;
      continue;
    }
    const affected = filesUnder(snapshot, from);
    if (affected.length === 0) {
      skipped++;
      continue;
    }
    const toLower = to.toLowerCase();
    const clash = [...taken].some((p) => {
      const l = p.toLowerCase();
      return l === toLower || l.startsWith(toLower + "/");
    });
    if (clash) throw new LibraryError(`"${baseName(from)}" naam se wahan pehle se kuch hai — pehle use rename karo.`, 409);
    if (!(affected.length === 1 && affected[0]!.path === from)) movedFolders.push(from);
    for (const e of affected) {
      const newPath = e.path === from ? to : to + e.path.slice(from.length);
      changes.push({ path: e.path, sha: null });
      changes.push({ path: newPath, sha: e.sha });
      taken.delete(e.path);
      taken.add(newPath);
      purge.push(e.path, newPath);
    }
    manifest = renameInManifest(manifest, from, to);
    moved++;
  }
  if (moved === 0) return { moved, skipped };
  // The destination's .keep placeholder is no longer needed once real items arrive.
  const keep = dest ? `${dest}/.keep` : null;
  if (keep && snapshot.files.some((e) => e.path === keep)) changes.push({ path: keep, sha: null });
  changes.push(manifestChange(manifest));
  changes.push(...keepEmptiedFolders(snapshot, changes, movedFolders));
  await commit(snapshot, changes, `Move ${moved} item${moved === 1 ? "" : "s"} to ${dest || "root"}`);
  await purgeCdnPaths(snapshot.repo, purge);
  return { moved, skipped };
}

/* ------------------------------ GitHub Pages ------------------------------ */

const NOJEKYLL_PATH = ".nojekyll";

/** Current Pages state for the storage repo (owner settings screen). */
export async function pagesStatus(): Promise<PagesInfo> {
  return getPagesInfo(getRepoConfig());
}

/**
 * Turns on GitHub Pages for the storage branch (root) and drops a `.nojekyll`
 * file so Pages serves every file as-is (Jekyll would skip folders that start
 * with `_` and try to "build" markdown). Safe to call again.
 */
export async function enablePages(): Promise<PagesInfo> {
  const snapshot = await loadSnapshot({ fresh: true });
  if (!snapshot.files.some((e) => e.path === NOJEKYLL_PATH)) {
    await commit(snapshot, [{ path: NOJEKYLL_PATH, content: "" }], "Enable GitHub Pages (.nojekyll)");
  }
  try {
    const info = await createPagesSite(snapshot.repo);
    await requestPagesBuild(snapshot.repo);
    return info;
  } catch (err) {
    if (err instanceof GitHubError) throw new LibraryError(err.message, err.status >= 500 ? 502 : err.status);
    throw err;
  }
}

/* ------------------------------------------------------------------ */
/* Browse home + category listings                                     */
/* ------------------------------------------------------------------ */

/** Order the type tiles appear in on the home screen. */
const CATEGORY_ORDER: FileKind[] = ["pdf", "image", "doc", "sheet", "slides", "text", "other"];

/**
 * One pass over the tree that powers the home screen: how much of each file
 * type there is, and every top-level folder as a collection card. Pure read
 * from the cached snapshot — no extra GitHub calls.
 */
export function buildBrowse(snapshot: Snapshot, includeHidden: boolean): BrowseView {
  const m = snapshot.manifest;
  const kinds = new Map<FileKind, { count: number; bytes: number; cover?: string }>();
  const tops = new Map<string, { files: number; folders: Set<string>; bytes: number; cover?: string }>();
  const totals = { files: 0, folders: 0, bytes: 0 };
  const biggest: Array<{ path: string; name: string; size: number; kind: FileKind }> = [];

  for (const entry of snapshot.files) {
    if (!visibleFile(entry)) continue;
    if (!includeHidden && isHiddenPath(m, entry.path)) continue;
    const size = entry.size ?? 0;
    const kind = fileKind(entry.path);
    totals.files += 1;
    totals.bytes += size;

    const agg = kinds.get(kind) ?? { count: 0, bytes: 0 };
    agg.count += 1;
    agg.bytes += size;
    if (!agg.cover && kind === "image") agg.cover = entry.path;
    kinds.set(kind, agg);

    biggest.push({ path: entry.path, name: baseName(entry.path), size, kind });

    const slash = entry.path.indexOf("/");
    if (slash === -1) continue;
    const top = entry.path.slice(0, slash);
    if (top.startsWith(".")) continue;
    const folder = tops.get(top) ?? { files: 0, folders: new Set<string>(), bytes: 0 };
    folder.files += 1;
    folder.bytes += size;
    if (!folder.cover && kind === "image") folder.cover = entry.path;
    const deeper = entry.path.slice(slash + 1);
    const nextSlash = deeper.indexOf("/");
    if (nextSlash !== -1) folder.folders.add(deeper.slice(0, nextSlash));
    tops.set(top, folder);
  }

  const order = m.order[""];
  const collections: BrowseCollection[] = sortChildren([...tops.keys()], order)
    .filter((name) => includeHidden || !isHiddenPath(m, name))
    .map((name) => {
      const agg = tops.get(name)!;
      const label = labelFor(m, name);
      return {
        name,
        path: name,
        title: label.title,
        note: label.note,
        fileCount: agg.files,
        folderCount: agg.folders.size,
        bytes: agg.bytes,
        cover: agg.cover,
      };
    });
  totals.folders = collections.length;

  const categories: BrowseCategory[] = CATEGORY_ORDER.filter((k) => kinds.has(k)).map((kind) => {
    const agg = kinds.get(kind)!;
    return { kind, count: agg.count, bytes: agg.bytes, cover: agg.cover };
  });

  return {
    repo: snapshot.repo,
    headSha: snapshot.headSha,
    settings: m.settings,
    totals,
    categories,
    collections,
    largest: biggest.sort((a, b) => b.size - a.size).slice(0, 5),
  };
}

/** Every file of one type across the library, grouped-ready (folder path included). */
export function kindListing(snapshot: Snapshot, kind: FileKind, includeHidden: boolean): KindListing {
  const m = snapshot.manifest;
  const files: KindListing["files"] = [];
  let bytes = 0;
  for (const entry of snapshot.files) {
    if (!visibleFile(entry)) continue;
    if (fileKind(entry.path) !== kind) continue;
    if (!includeHidden && isHiddenPath(m, entry.path)) continue;
    const name = baseName(entry.path);
    const label = labelFor(m, entry.path);
    bytes += entry.size ?? 0;
    files.push({
      folder: parentPath(entry.path),
      file: {
        type: "file",
        name,
        path: entry.path,
        size: entry.size ?? 0,
        sha: entry.sha,
        kind,
        title: label.title,
        note: label.note,
        hidden: isHiddenPath(m, entry.path),
      },
    });
  }
  files.sort((a, b) => naturalCompare(a.folder, b.folder) || naturalCompare(a.file.name, b.file.name));
  return { repo: snapshot.repo, headSha: snapshot.headSha, settings: m.settings, kind, bytes, files };
}
