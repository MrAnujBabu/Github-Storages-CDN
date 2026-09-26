/** Pure path helpers shared by server and browser. */

export type FileKind = "pdf" | "image" | "doc" | "sheet" | "slides" | "text" | "other";

const UNSAFE_CHARS = /[\\:*?"<>|#%\u0000-\u001f]/g;

export function normalizePath(input: string): string {
  return input
    .replace(/\\/g, "/")
    .split("/")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .join("/");
}

/** True when a path is safe to use inside the repo (no traversal, no dotfiles). */
export function isSafePath(path: string): boolean {
  if (path === "") return true;
  if (path.length > 900) return false;
  if (/[\u0000-\u001f]/.test(path)) return false;
  const parts = path.split("/");
  return parts.every((p) => p.length > 0 && p !== "." && p !== ".." && !p.startsWith("."));
}

export function isSafeName(name: string): boolean {
  if (!name || name.length > 200) return false;
  if (name === "." || name === "..") return false;
  if (name.startsWith(".")) return false;
  if (name.includes("/") || name.includes("\\")) return false;
  if (/[\u0000-\u001f]/.test(name)) return false;
  return true;
}

export function joinPath(...parts: Array<string | undefined | null>): string {
  return normalizePath(parts.filter(Boolean).join("/"));
}

export function parentPath(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

export function baseName(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? path : path.slice(i + 1);
}

export function extensionOf(name: string): string {
  const base = baseName(name);
  const i = base.lastIndexOf(".");
  return i <= 0 ? "" : base.slice(i + 1).toLowerCase();
}

export function stripExtension(name: string): string {
  const i = name.lastIndexOf(".");
  return i <= 0 ? name : name.slice(0, i);
}

export function fileKind(name: string): FileKind {
  const ext = extensionOf(name);
  if (ext === "pdf") return "pdf";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "avif", "heic"].includes(ext)) return "image";
  if (["doc", "docx", "odt", "rtf"].includes(ext)) return "doc";
  if (["xls", "xlsx", "csv", "ods"].includes(ext)) return "sheet";
  if (["ppt", "pptx", "odp", "key"].includes(ext)) return "slides";
  if (["md", "txt", "json"].includes(ext)) return "text";
  return "other";
}

export function kindLabel(kind: FileKind): string {
  switch (kind) {
    case "pdf":
      return "PDF";
    case "image":
      return "Image";
    case "doc":
      return "Document";
    case "sheet":
      return "Sheet";
    case "slides":
      return "Slides";
    case "text":
      return "Text";
    default:
      return "File";
  }
}

/** Entries the app never shows (manifest, git keep files, dotfiles). */
export function isHiddenEntry(name: string): boolean {
  return name.startsWith(".") || name === "Thumbs.db" || name === "desktop.ini";
}

export interface CleanNameOptions {
  /** Replace spaces with hyphens and collapse repeats. */
  slug?: boolean;
}

/**
 * Makes a file name safe for GitHub + CDN links. Keeps the extension,
 * removes characters that break URLs, optionally turns spaces into hyphens.
 */
export function cleanFileName(raw: string, opts: CleanNameOptions = {}): string {
  let name = raw.normalize("NFKC").replace(UNSAFE_CHARS, "").replace(/\s+/g, " ").trim();
  name = name.replace(/^\.+/, "");
  if (opts.slug) {
    const ext = extensionOf(name);
    let stem = ext ? name.slice(0, -(ext.length + 1)) : name;
    stem = stem
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    name = ext ? `${stem || "file"}.${ext}` : stem || "file";
  }
  if (!name) name = "file";
  return name.slice(0, 180);
}

export function cleanFolderName(raw: string, opts: CleanNameOptions = {}): string {
  let name = raw.normalize("NFKC").replace(UNSAFE_CHARS, "").replace(/\//g, "").replace(/\s+/g, " ").trim();
  name = name.replace(/^\.+/, "");
  if (opts.slug) {
    name = name
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }
  return name.slice(0, 120);
}

export function formatBytes(bytes: number | undefined | null): string {
  if (!bytes || bytes <= 0) return "0 KB";
  const units = ["B", "KB", "MB", "GB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const digits = v >= 100 || i === 0 ? 0 : 1;
  return `${v.toFixed(digits)} ${units[i]}`;
}

/** Natural, case-insensitive compare ("Lec 2" before "Lec 10"). */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/** Short readable title from a file name: strips extension, replaces separators. */
export function prettyName(name: string): string {
  return stripExtension(name).replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
}
