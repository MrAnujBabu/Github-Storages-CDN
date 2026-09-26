import { queryOptions } from "@tanstack/react-query";

import type { FileKind } from "./paths";

import {
  checkFileLinks,
  getAllFolders,
  getBrowse,
  getFile,
  getFolder,
  getKindFiles,
  getPagesStatus,
  getSession,
  getStats,
  searchLibrary,
} from "./library.functions";

/** Owner-only: GitHub Pages state of the storage repo. */
export const pagesQuery = queryOptions({
  queryKey: ["pages"],
  queryFn: () => getPagesStatus(),
  staleTime: 30_000,
});

/** Live status of every link format for one file (keyed on the commit so a new upload re-checks). */
export const linkHealthQuery = (path: string, commit?: string | null) =>
  queryOptions({
    queryKey: ["linkcheck", path, commit ?? ""],
    queryFn: () => checkFileLinks({ data: { path } }),
    staleTime: 45_000,
    retry: 1,
  });

export const folderQuery = (path: string) =>
  queryOptions({
    queryKey: ["folder", path],
    queryFn: () => getFolder({ data: { path } }),
    staleTime: 30_000,
  });

export const fileQuery = (path: string) =>
  queryOptions({
    queryKey: ["file", path],
    queryFn: () => getFile({ data: { path } }),
    staleTime: 30_000,
  });

export const sessionQuery = queryOptions({
  queryKey: ["session"],
  queryFn: () => getSession(),
  staleTime: 60_000,
});

export const foldersQuery = queryOptions({
  queryKey: ["folders"],
  queryFn: () => getAllFolders(),
  staleTime: 30_000,
});

export const statsQuery = queryOptions({
  queryKey: ["stats"],
  queryFn: () => getStats(),
  staleTime: 60_000,
});

export const searchQuery = (q: string) =>
  queryOptions({
    queryKey: ["search", q],
    queryFn: () => searchLibrary({ data: { q } }),
    enabled: q.trim().length >= 2,
    staleTime: 30_000,
  });

/** Home screen: type tiles + collections, one snapshot read. */
export const browseQuery = queryOptions({
  queryKey: ["browse"],
  queryFn: () => getBrowse(),
  staleTime: 30_000,
});

export const kindQuery = (kind: FileKind) =>
  queryOptions({
    queryKey: ["kind", kind],
    queryFn: () => getKindFiles({ data: { kind } }),
    staleTime: 30_000,
  });
