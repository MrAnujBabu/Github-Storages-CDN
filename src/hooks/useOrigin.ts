import { useHydrated } from "@tanstack/react-router";

/** The app's origin for viewer links; empty during SSR so markup stays stable. */
export function useOrigin(): string {
  const hydrated = useHydrated();
  if (!hydrated || typeof window === "undefined") return "";
  return window.location.origin;
}
