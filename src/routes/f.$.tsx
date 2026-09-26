import { createFileRoute, notFound } from "@tanstack/react-router";

import { AppShell } from "@/components/library/AppShell";
import { FolderPage } from "@/components/library/FolderPage";
import { EmptyState, ErrorState, FolderPageSkeleton } from "@/components/library/states";
import { splatToPath } from "@/lib/route-path";
import { folderQuery } from "@/lib/queries";
import { APP_NAME } from "@/lib/storage-config";

export const Route = createFileRoute("/f/$")({
  loader: async ({ context, params }) => {
    const path = splatToPath(params._splat);
    const view = await context.queryClient.ensureQueryData(folderQuery(path));
    if (!view.exists) throw notFound();
    return { path, title: view.title, files: view.totals.files, folders: view.totals.folders };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: `Folder — ${APP_NAME}` }, { name: "robots", content: "noindex" }] };
    const desc = `${loaderData.title} — ${loaderData.files} file${loaderData.files === 1 ? "" : "s"}${
      loaderData.folders ? `, ${loaderData.folders} folder${loaderData.folders === 1 ? "" : "s"}` : ""
    }. PDFs aur notes, CDN link ke saath.`;
    return {
      meta: [
        { title: `${loaderData.title} — ${APP_NAME}` },
        { name: "description", content: desc },
        { property: "og:title", content: `${loaderData.title} — ${APP_NAME}` },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: FolderRoute,
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
  notFoundComponent: () => (
    <AppShell>
      <EmptyState
        title="Ye folder nahi mila."
        hint="Shayad rename ya delete ho gaya hai. Library ke root se dobara dhoondho."
        action={
          <a href="/" className="pressable inline-flex h-11 items-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground">
            Library par jao
          </a>
        }
      />
    </AppShell>
  ),
});

function FolderRoute() {
  const { path } = Route.useLoaderData();
  return <FolderPage path={path} />;
}
