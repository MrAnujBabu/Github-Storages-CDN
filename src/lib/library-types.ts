import type { LinkHealth, LinkHealthState, LinkStyle } from "./links";
import type { ManifestSettings } from "./manifest";
import type { FileKind } from "./paths";
import type { RepoRef } from "./storage-config";

export interface LibraryFile {
  type: "file";
  name: string;
  path: string;
  size: number;
  sha: string;
  kind: FileKind;
  title?: string | undefined;
  note?: string | undefined;
  hidden: boolean;
}

export interface LibraryFolder {
  type: "folder";
  name: string;
  path: string;
  fileCount: number;
  folderCount: number;
  bytes: number;
  /** Path of an image inside the folder, used as a cover in grid view. */
  cover?: string | undefined;
  title?: string | undefined;
  note?: string | undefined;
  hidden: boolean;
}

export type LibraryItem = LibraryFile | LibraryFolder;

export interface Crumb {
  name: string;
  path: string;
}

export interface FolderView {
  repo: RepoRef;
  path: string;
  exists: boolean;
  crumbs: Crumb[];
  title: string;
  note?: string | undefined;
  hidden: boolean;
  items: LibraryItem[];
  /** True when the owner arranged this folder by hand. */
  customOrder: boolean;
  headSha: string;
  settings: ManifestSettings;
  totals: { files: number; folders: number; bytes: number };
  /** Whether hidden items are included (owner view). */
  includesHidden: boolean;
}

export interface FileDetail {
  repo: RepoRef;
  file: LibraryFile;
  /** Path actually requested; differs from file.path when an alias resolved it. */
  requestedPath: string;
  headSha: string;
  settings: ManifestSettings;
  crumbs: Crumb[];
  prev?: { name: string; path: string } | null;
  next?: { name: string; path: string } | null;
}

export interface SessionInfo {
  signedIn: boolean;
  repo: RepoRef;
  passcodeConfigured: boolean;
  githubConfigured: boolean;
  defaultLinkStyle: LinkStyle;
  /** Owner-set public origin for viewer links; undefined → use the current page's origin. */
  appUrl?: string | undefined;
}

export interface SearchHit {
  file: LibraryFile;
  folder: string;
}

export interface LibraryStats {
  files: number;
  folders: number;
  bytes: number;
  byKind: Record<string, number>;
  largest: Array<{ path: string; size: number }>;
}

/** GitHub Pages state of the storage repo (browser-safe mirror of github.server's PagesInfo). */
export interface PagesInfo {
  enabled: boolean;
  /** null | "queued" | "building" | "built" | "errored" */
  status: string | null;
  url: string | null;
  sourceBranch: string | null;
  sourcePath: string | null;
}

/** One public delivery channel (Pages, jsDelivr, …) summarised over a sample of files. */
export interface DeliveryChannel {
  style: LinkStyle;
  /** Files that answered 2xx/3xx. */
  ok: number;
  total: number;
  /** Median round-trip of the successful probes, in ms. */
  medianMs: number | null;
  /** Worst state seen across the sample: ok < pending < blocked < down. */
  state: LinkHealthState;
}

/** Library-wide link status: a small sample of real files probed on every channel. */
export interface DeliveryHealth {
  checkedAt: string;
  headSha: string;
  samples: Array<{ path: string; name: string; results: LinkHealth[] }>;
  channels: DeliveryChannel[];
}

export interface UploadedEntry {
  name: string;
  path: string;
  size: number;
  replaced: boolean;
}

export interface UploadResponse {
  ok: true;
  commitSha: string;
  uploaded: UploadedEntry[];
}

/* ------------------------- Browse (home) read models ------------------------- */

/** One file-type tile on the browse home ("PDFs — 24 files · 18 MB"). */
export interface BrowseCategory {
  kind: FileKind;
  count: number;
  bytes: number;
  /** A file inside this category, used as the tile's preview (images only). */
  cover?: string | undefined;
}

/** A top-level folder shown as a collection card. */
export interface BrowseCollection {
  name: string;
  path: string;
  title?: string | undefined;
  note?: string | undefined;
  fileCount: number;
  folderCount: number;
  bytes: number;
  cover?: string | undefined;
}

export interface BrowseView {
  repo: RepoRef;
  headSha: string;
  settings: ManifestSettings;
  totals: { files: number; folders: number; bytes: number };
  categories: BrowseCategory[];
  collections: BrowseCollection[];
  /** Biggest files, for the storage card. */
  largest: Array<{ path: string; name: string; size: number; kind: FileKind }>;
}

/** Every file of one type across the whole library. */
export interface KindListing {
  repo: RepoRef;
  headSha: string;
  settings: ManifestSettings;
  kind: FileKind;
  bytes: number;
  files: Array<{ file: LibraryFile; folder: string }>;
}
