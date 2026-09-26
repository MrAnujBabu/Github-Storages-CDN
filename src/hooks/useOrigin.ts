import { useQuery } from "@tanstack/react-query";
import { useHydrated } from "@tanstack/react-router";

import { sessionQuery } from "@/lib/queries";

/** The page's own origin; empty during SSR so markup stays stable. */
export function useOrigin(): string {
  const hydrated = useHydrated();
  if (!hydrated || typeof window === "undefined") return "";
  return window.location.origin;
}

/**
 * Origin every viewer link should be built on: the owner's public app address
 * when one is saved in Settings, else the current page's origin. Inside the
 * Lovable preview the latter is private, which is exactly why the setting exists.
 */
export function useLinkOrigin(): string {
  const origin = useOrigin();
  const { data } = useQuery(sessionQuery);
  return data?.appUrl || origin;
}
