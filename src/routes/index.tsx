import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/library/AppShell";
import { BrowseHome } from "@/components/library/BrowseHome";
import { ErrorState, GridSkeleton } from "@/components/library/states";
import { Skeleton } from "@/components/ui/skeleton";
import { browseQuery } from "@/lib/queries";
import { APP_NAME, APP_TAGLINE } from "@/lib/storage-config";

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(browseQuery),
  head: () => ({
    meta: [
      { title: `${APP_NAME} — PDF aur notes library` },
      { name: "description", content: `${APP_TAGLINE} Type, folder ya search se file kholo aur link ek tap mein copy karo.` },
      { property: "og:title", content: `${APP_NAME} — PDF aur notes library` },
      { property: "og:description", content: APP_TAGLINE },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BrowseHome,
  pendingComponent: () => (
    <AppShell compact>
      <Skeleton className="h-13 w-full rounded-2xl" />
      <div className="mt-6 space-y-3">
        <Skeleton className="h-5 w-40" />
        <GridSkeleton cards={4} />
      </div>
    </AppShell>
  ),
  errorComponent: ({ error, reset }) => (
    <AppShell compact>
      <ErrorState message={error.message} onRetry={reset} />
    </AppShell>
  ),
});
