import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/library/AppShell";
import { FolderPage } from "@/components/library/FolderPage";
import { ErrorState, FolderPageSkeleton } from "@/components/library/states";
import { folderQuery } from "@/lib/queries";
import { APP_NAME, APP_TAGLINE } from "@/lib/storage-config";

/** The full root folder listing — the home screen's "Poori library kholo". */
export const Route = createFileRoute("/files")({
  loader: ({ context }) => context.queryClient.ensureQueryData(folderQuery("")),
  head: () => ({
    meta: [
      { title: `Saari files — ${APP_NAME}` },
      { name: "description", content: `${APP_TAGLINE} Folder khol kar file kholo, arrange karo ya link copy karo.` },
      { property: "og:title", content: `Saari files — ${APP_NAME}` },
      { property: "og:description", content: APP_TAGLINE },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <FolderPage path="" />,
  pendingComponent: () => (
    <AppShell>
      <FolderPageSkeleton />
    </AppShell>
  ),
  errorComponent: ({ error, reset }) => (
    <AppShell>
      <ErrorState message={error.message} onRetry={reset} />
    </AppShell>
  ),
});
