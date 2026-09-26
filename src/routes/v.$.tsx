import { createFileRoute, notFound } from "@tanstack/react-router";

import { AppShell } from "@/components/library/AppShell";
import { EmptyState, ErrorState } from "@/components/library/states";
import { Viewer } from "@/components/library/Viewer";
import { buildLink } from "@/lib/links";
import { kindLabel, formatBytes } from "@/lib/paths";
import { fileQuery } from "@/lib/queries";
import { splatToPath } from "@/lib/route-path";
import { APP_NAME } from "@/lib/storage-config";

export const Route = createFileRoute("/v/$")({
  loader: async ({ context, params }) => {
    const path = splatToPath(params._splat);
    if (!path) throw notFound();
    const detail = await context.queryClient.ensureQueryData(fileQuery(path));
    if (!detail) throw notFound();
    const { file, repo } = detail;
    return {
      path,
      title: file.title ?? file.name,
      kind: file.kind,
      size: file.size,
      folder: detail.crumbs[detail.crumbs.length - 1]?.name ?? "Library",
      image: file.kind === "image" ? buildLink("cdn", file.path, { repo }) : null,
    };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: `File — ${APP_NAME}` }, { name: "robots", content: "noindex" }] };
    const t = `${loaderData.title} — ${APP_NAME}`;
    const d = `${kindLabel(loaderData.kind)} · ${formatBytes(loaderData.size)} · ${loaderData.folder}. Browser mein kholo ya link copy karo.`;
    const meta: Array<Record<string, string>> = [
      { title: t },
      { name: "description", content: d },
      { property: "og:title", content: t },
      { property: "og:description", content: d },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: loaderData.image ? "summary_large_image" : "summary" },
    ];
    if (loaderData.image) {
      meta.push({ property: "og:image", content: loaderData.image }, { name: "twitter:image", content: loaderData.image });
    }
    return { meta };
  },
  component: ViewerRoute,
  pendingComponent: () => (
    <div className="flex h-dvh flex-col bg-background">
      <div className="h-14 border-b border-border sm:h-16" />
      <div className="flex flex-1 items-center justify-center bg-muted/60 p-6">
        <div className="w-full max-w-2xl animate-pulse rounded-md bg-card shadow-card" style={{ aspectRatio: "1 / 1.3" }} />
      </div>
    </div>
  ),
  errorComponent: ({ error, reset }) => (
    <AppShell compact>
      <ErrorState message={error.message} onRetry={reset} />
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell compact>
      <EmptyState
        title="Ye file nahi mili."
        hint="Link purana ho sakta hai — file rename ya delete hui hogi. Library mein dhoondho."
        action={
          <a href="/" className="pressable inline-flex h-11 items-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground">
            Library par jao
          </a>
        }
      />
    </AppShell>
  ),
});

function ViewerRoute() {
  const { path } = Route.useLoaderData();
  return <Viewer path={path} />;
}
