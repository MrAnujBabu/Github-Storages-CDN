import { normalizePath } from "./paths";

/** Turns a `$` splat param into a clean repo path; tolerates encoded or raw segments. */
export function splatToPath(splat: string | undefined): string {
  if (!splat) return "";
  let s = splat;
  try {
    s = decodeURIComponent(splat);
  } catch {
    // keep raw when not valid percent-encoding
  }
  return normalizePath(s);
}
