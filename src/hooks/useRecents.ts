import { useCallback, useEffect, useState } from "react";

import type { FileKind } from "@/lib/paths";

/**
 * "Recent" on the home screen. Git gives no per-file open history, and the
 * app has no database, so recents live in this browser only — zero server
 * and zero Supabase load.
 */
export interface RecentEntry {
  path: string;
  name: string;
  title?: string;
  kind: FileKind;
  size: number;
  at: number;
}

const KEY = "nb:recents";
const MAX = 12;

function read(): RecentEntry[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e): e is RecentEntry => Boolean(e) && typeof (e as RecentEntry).path === "string")
      .slice(0, MAX);
  } catch {
    return [];
  }
}

function write(entries: RecentEntry[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX)));
  } catch {
    // private mode / storage full — recents are a convenience, never required
  }
}

/** Remember that a file was opened. Safe to call on every viewer mount. */
export function rememberRecent(entry: Omit<RecentEntry, "at">): void {
  if (typeof window === "undefined") return;
  const next = [{ ...entry, at: Date.now() }, ...read().filter((e) => e.path !== entry.path)];
  write(next);
  window.dispatchEvent(new Event("nb:recents"));
}

export function useRecents() {
  // Starts empty so server and first client render match; fills after hydration.
  const [recents, setRecents] = useState<RecentEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setRecents(read());
    sync();
    setReady(true);
    window.addEventListener("nb:recents", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("nb:recents", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const clear = useCallback(() => {
    write([]);
    setRecents([]);
  }, []);

  /** Drops entries whose file no longer exists in the library. */
  const prune = useCallback((livePaths: Set<string>) => {
    const kept = read().filter((e) => livePaths.has(e.path));
    write(kept);
    setRecents(kept);
  }, []);

  return { recents, ready, clear, prune };
}
