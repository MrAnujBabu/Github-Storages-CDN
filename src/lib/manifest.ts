import { ALL_LINK_STYLES, type LinkStyle, normalizeAppUrl } from "./links";
import { naturalCompare } from "./paths";

/**
 * The manifest lives at .library/manifest.json inside the storage repo.
 * It holds everything the app knows beyond the raw file tree: the custom
 * order of each folder, display labels, hidden items, and settings.
 * GitHub stays the single source of truth — no database.
 */
export interface ItemLabel {
  title?: string | undefined;
  note?: string | undefined;
}

export interface ManifestSettings {
  linkStyle: LinkStyle;
  /**
   * Public origin of this app (e.g. https://files.example.com). Viewer links are
   * built on it so links copied inside a private preview still open for everyone.
   */
  appUrl?: string | undefined;
}

export interface Manifest {
  version: 1;
  settings: ManifestSettings;
  /** folder path ("" for root) -> ordered child names (folders and files mixed) */
  order: Record<string, string[]>;
  /** item path -> label */
  labels: Record<string, ItemLabel>;
  /** item paths hidden from visitors */
  hidden: string[];
  /** old path -> new path, kept when items are renamed or moved */
  aliases: Record<string, string>;
  updatedAt?: string | undefined;
}

export function emptyManifest(): Manifest {
  return {
    version: 1,
    settings: { linkStyle: "pages" },
    order: {},
    labels: {},
    hidden: [],
    aliases: {},
  };
}

const LINK_STYLES: LinkStyle[] = ALL_LINK_STYLES;

/** Aliases are kept so old links keep resolving; cap them so the manifest cannot grow forever. */
const MAX_ALIASES = 600;

function capAliases(aliases: Record<string, string>): Record<string, string> {
  const entries = Object.entries(aliases);
  if (entries.length <= MAX_ALIASES) return aliases;
  // Object key order is insertion order → the oldest aliases come first; drop those.
  return Object.fromEntries(entries.slice(entries.length - MAX_ALIASES));
}

/** Parses manifest JSON defensively; anything malformed falls back to defaults. */
/** Repo JSON is untrusted: never let a key like "__proto__" reach a plain object. */
function isSafeKey(key: string): boolean {
  return key !== "__proto__" && key !== "constructor" && key !== "prototype";
}

export function parseManifest(text: string | null | undefined): Manifest {
  const base = emptyManifest();
  if (!text) return base;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return base;
  }
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;

  const settings = (r["settings"] ?? {}) as Record<string, unknown>;
  const linkStyle = LINK_STYLES.includes(settings["linkStyle"] as LinkStyle)
    ? (settings["linkStyle"] as LinkStyle)
    : "pages";
  const appUrl = normalizeAppUrl(typeof settings["appUrl"] === "string" ? settings["appUrl"] : null);

  const order: Record<string, string[]> = {};
  if (r["order"] && typeof r["order"] === "object") {
    for (const [k, v] of Object.entries(r["order"] as Record<string, unknown>)) {
      if (!isSafeKey(k)) continue;
      if (Array.isArray(v)) order[k] = v.filter((x): x is string => typeof x === "string");
    }
  }

  const labels: Record<string, ItemLabel> = {};
  if (r["labels"] && typeof r["labels"] === "object") {
    for (const [k, v] of Object.entries(r["labels"] as Record<string, unknown>)) {
      if (!isSafeKey(k)) continue;
      if (v && typeof v === "object") {
        const l = v as Record<string, unknown>;
        const label: ItemLabel = {};
        if (typeof l["title"] === "string" && l["title"].trim()) label["title"] = l["title"].trim();
        if (typeof l["note"] === "string" && l["note"].trim()) label["note"] = l["note"].trim();
        if (label["title"] || label["note"]) labels[k] = label;
      }
    }
  }

  const hidden = Array.isArray(r["hidden"]) ? r["hidden"].filter((x): x is string => typeof x === "string") : [];

  const aliases: Record<string, string> = {};
  if (r["aliases"] && typeof r["aliases"] === "object") {
    for (const [k, v] of Object.entries(r["aliases"] as Record<string, unknown>)) {
      if (!isSafeKey(k)) continue;
      if (typeof v === "string") aliases[k] = v;
    }
  }

  return {
    version: 1,
    settings: appUrl ? { linkStyle, appUrl } : { linkStyle },
    order,
    labels,
    hidden,
    aliases,
    updatedAt: typeof r["updatedAt"] === "string" ? r["updatedAt"] : undefined,
  };
}

export function serializeManifest(m: Manifest): string {
  const out: Manifest = { ...m, updatedAt: new Date().toISOString() };
  return JSON.stringify(out, null, 2) + "\n";
}

/**
 * Sorts child names: items present in `order` keep that order (first),
 * everything else follows in natural alphabetical order.
 */
export function sortChildren(names: string[], order: string[] | undefined): string[] {
  if (!order || order.length === 0) return [...names].sort(naturalCompare);
  const pos = new Map<string, number>();
  order.forEach((n, i) => {
    if (!pos.has(n)) pos.set(n, i);
  });
  const ordered = names.filter((n) => pos.has(n)).sort((a, b) => pos.get(a)! - pos.get(b)!);
  const rest = names.filter((n) => !pos.has(n)).sort(naturalCompare);
  return [...ordered, ...rest];
}

/** Follows rename/move aliases to the current path (bounded to avoid loops). */
export function resolveAlias(m: Manifest, path: string, maxHops = 10): string {
  let cur = path;
  for (let i = 0; i < maxHops; i++) {
    const next = m.aliases[cur];
    if (!next || next === cur) break;
    cur = next;
  }
  return cur;
}

function replacePrefix(path: string, from: string, to: string): string | null {
  if (path === from) return to;
  if (path.startsWith(from + "/")) return to + path.slice(from.length);
  return null;
}

/**
 * Rewrites every manifest reference from `from` to `to` (works for files and
 * whole folders) and records an alias so old links keep resolving.
 */
export function renameInManifest(m: Manifest, from: string, to: string): Manifest {
  const next: Manifest = {
    ...m,
    order: {},
    labels: {},
    hidden: [],
    aliases: { ...m.aliases },
  };

  for (const [folder, names] of Object.entries(m.order)) {
    const newFolder = replacePrefix(folder, from, to) ?? folder;
    next.order[newFolder] = names;
  }
  // Rename inside the parent's order list when only the base name changed
  const fromParent = from.includes("/") ? from.slice(0, from.lastIndexOf("/")) : "";
  const toParent = to.includes("/") ? to.slice(0, to.lastIndexOf("/")) : "";
  const fromName = from.slice(fromParent ? fromParent.length + 1 : 0);
  const toName = to.slice(toParent ? toParent.length + 1 : 0);
  if (fromParent === toParent && next.order[fromParent]) {
    next.order[fromParent] = next.order[fromParent]!.map((n) => (n === fromName ? toName : n));
  } else if (next.order[fromParent]) {
    next.order[fromParent] = next.order[fromParent]!.filter((n) => n !== fromName);
  }

  for (const [p, label] of Object.entries(m.labels)) {
    next.labels[replacePrefix(p, from, to) ?? p] = label;
  }
  next.hidden = m.hidden.map((p) => replacePrefix(p, from, to) ?? p);

  // Point every alias that used to land on `from` at `to`, then add the new alias.
  for (const [k, v] of Object.entries(next.aliases)) {
    const moved = replacePrefix(v, from, to);
    if (moved) next.aliases[k] = moved;
  }
  next.aliases[from] = to;
  delete next.aliases[to];
  next.aliases = capAliases(next.aliases);
  return next;
}

/** Drops every manifest reference to a deleted file or folder. */
export function removeFromManifest(m: Manifest, path: string): Manifest {
  const under = (p: string) => p === path || p.startsWith(path + "/");
  const next: Manifest = { ...m, order: {}, labels: {}, hidden: [], aliases: {} };
  for (const [folder, names] of Object.entries(m.order)) {
    if (under(folder)) continue;
    next.order[folder] = names;
  }
  const parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  const name = path.slice(parent ? parent.length + 1 : 0);
  if (next.order[parent]) next.order[parent] = next.order[parent]!.filter((n) => n !== name);
  for (const [p, label] of Object.entries(m.labels)) if (!under(p)) next.labels[p] = label;
  next.hidden = m.hidden.filter((p) => !under(p));
  for (const [k, v] of Object.entries(m.aliases)) if (!under(v) && !under(k)) next.aliases[k] = v;
  return next;
}

export function setOrder(m: Manifest, folder: string, names: string[]): Manifest {
  return { ...m, order: { ...m.order, [folder]: names } };
}

export function setLabel(m: Manifest, path: string, label: ItemLabel): Manifest {
  const labels = { ...m.labels };
  const clean: ItemLabel = {};
  if (label["title"]?.trim()) clean.title = label["title"].trim().slice(0, 120);
  if (label["note"]?.trim()) clean.note = label["note"].trim().slice(0, 400);
  if (clean.title || clean.note) labels[path] = clean;
  else delete labels[path];
  return { ...m, labels };
}

export function setHidden(m: Manifest, path: string, hidden: boolean): Manifest {
  const set = new Set(m.hidden);
  if (hidden) set.add(path);
  else set.delete(path);
  return { ...m, hidden: [...set] };
}

export function isHiddenPath(m: Manifest, path: string): boolean {
  return m.hidden.some((h) => h === path || path.startsWith(h + "/"));
}
