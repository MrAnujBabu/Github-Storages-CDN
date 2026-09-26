/**
 * Best-effort haptics for the web. Uses the Vibration API where available
 * (Android Chrome); silently no-ops elsewhere. Only call from a direct user
 * gesture handler.
 */
type Strength = "light" | "medium" | "heavy" | "selection";

const PATTERN: Record<Strength, number | number[]> = {
  selection: 6,
  light: 10,
  medium: 18,
  heavy: [24, 30, 24],
};

export function haptic(strength: Strength = "light"): void {
  try {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    navigator.vibrate(PATTERN[strength]);
  } catch {
    // vibration blocked (no gesture / unsupported) — nothing to do
  }
}
