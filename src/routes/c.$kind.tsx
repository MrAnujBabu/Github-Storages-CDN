import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useMemo } from "react";

import { AppShell, PageTitle } from "@/components/library/AppShell";
import { kindTitle } from "@/components/library/BrowseHome";
import { CopyLinkButton } from "@/components/library/CopyLinkButton";
import { KindIcon, extBadge } from "@/components/library/KindIcon";
import { EmptyState, ErrorState, RowSkeleton } from "@/components/library/states";
import { Button } from "@/components/ui/button";
import { useOwner } from "@/hooks/useOwner";
import { haptic } from "@/lib/haptics";
import { formatBytes, type FileKind } from "@/lib/paths";
import { kindQuery } from "@/lib/queries";
import { APP_NAME } from "@/lib/storage-config";

const KINDS: FileKind[] = ["pdf", "image", "doc", "sheet", "slides", "text", "other"];

function parseKind(raw: string): FileKind {
  const k = KINDS.find((x) => x === raw);
  if (!k) throw notFound();
  return k;
}

export const Route = createFileRoute("/c/$kind")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(kindQuery(parseKind(params.kind))),
  head: ({ params }) => {
    const k = KINDS.find((x) => x === params.kind);
    const title = k ? `${kindTitle(k)} — ${APP_NAME}` : `Files — ${APP_NAME}`;
    const desc = k
      ? `Poori library ke saare ${kindTitle(k)} ek jagah. Kholo ya link copy karo.`
      : "Library ki files.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: KindPage,
  pendingComponent: () => (
    <AppShell>
      <RowSkeleton rows={7} />
    </AppShell>
  ),
  errorComponent: ({ error, reset }) => (
    <AppShell>
      <ErrorState message={error.message} onRetry={reset} />
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <EmptyState title="Aisa koi type nahi hai." hint="Home se koi type chuno." />
    </AppShell>
  ),
});

function KindPage() {
  const { kind } = Route.useParams();
  const { data } = useSuspenseQuery(kindQuery(parseKind(kind)));
  const { session } = useOwner();
  const style = data.settings.linkStyle ?? session?.defaultLinkStyle ?? "pages";

  const grouped = useMemo(() => {
    const map = new Map<string, typeof data.files>();
    for (const hit of data.files) {
      const arr = map.get(hit.folder) ?? [];
      arr.push(hit);
      map.set(hit.folder, arr);
    }
    return [...map.entries()];
  }, [data.files]);

  return (
    <AppShell>
      <div className="mb-3">
        <Button asChild variant="ghost" className="h-9 rounded-full px-2.5 text-[13px] text-muted-foreground">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            Home
          </Link>
        </Button>
      </div>

      <PageTitle
        title={kindTitle(data.kind)}
        meta={
          <>
            {data.files.length} file{data.files.length === 1 ? "" : "s"}
            {data.bytes ? ` · ${formatBytes(data.bytes)}` : null}
          </>
        }
      />

      <div className="mt-5 space-y-5">
        {grouped.length === 0 ? (
          <EmptyState title="Is type ki koi file nahi hai." hint="Doosra type dekho ya library se browse karo." />
        ) : (
          grouped.map(([folder, hits]) => (
            <section key={folder || "__root"}>
              <h2 className="mb-2 px-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {folder ? (
                  <Link to="/f/$" params={{ _splat: folder }} className="hover:text-foreground">
                    {folder.split("/").join(" › ")}
                  </Link>
                ) : (
                  <Link to="/files" className="hover:text-foreground">
                    Library
                  </Link>
                )}
              </h2>
              <ul className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                {hits.map(({ file }) => (
                  <li key={file.path} className="flex items-center gap-1 border-b border-border last:border-b-0">
                    <Link
                      to="/v/$"
                      params={{ _splat: file.path }}
                      onClick={() => haptic("selection")}
                      className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-3 pr-1 active:bg-muted/60 sm:pl-4 [@media(hover:hover)]:hover:bg-muted/50"
                    >
                      <KindIcon kind={file.kind} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium text-foreground">{file.title ?? file.name}</span>
                        <span className="block truncate text-[12.5px] text-muted-foreground tabular-nums">
                          <span className="font-mono">{extBadge(file.name)}</span>
                          <span className="mx-1.5 opacity-60">·</span>
                          {formatBytes(file.size)}
                        </span>
                      </span>
                    </Link>
                    <div className="pr-1.5">
                      <CopyLinkButton path={file.path} repo={data.repo} commit={data.headSha} style={style} />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </AppShell>
  );
}
