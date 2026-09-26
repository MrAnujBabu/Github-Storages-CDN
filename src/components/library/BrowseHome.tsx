import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Clock, FolderOpen, HardDrive, Search, X } from "lucide-react";
import { type ReactNode, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { useOwner } from "@/hooks/useOwner";
import { useRecents } from "@/hooks/useRecents";
import { haptic } from "@/lib/haptics";
import { buildLink } from "@/lib/links";
import { formatBytes, type FileKind } from "@/lib/paths";
import { browseQuery } from "@/lib/queries";
import { CDN_PACKAGE_LIMIT_BYTES, CDN_PACKAGE_WARN_BYTES, PAGES_SITE_LIMIT_BYTES } from "@/lib/storage-config";
import { cn } from "@/lib/utils";

import { AppShell } from "./AppShell";
import { CopyLinkButton } from "./CopyLinkButton";
import { DeliveryHealthCard } from "./DeliveryHealthCard";
import { KindIcon } from "./KindIcon";

/** Plain-language plural names for the category tiles. */
const KIND_TITLE: Record<FileKind, string> = {
  pdf: "PDFs",
  image: "Photos",
  doc: "Documents",
  sheet: "Sheets",
  slides: "Slides",
  text: "Notes",
  other: "Baaki files",
};

export function kindTitle(kind: FileKind): string {
  return KIND_TITLE[kind];
}

function SectionHead({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-end justify-between gap-3 px-1">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
        {hint ? <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function BrowseHome() {
  const { data: browse } = useSuspenseQuery(browseQuery);
  const { isOwner, session } = useOwner();
  const { recents, ready, clear, prune } = useRecents();
  const navigate = useNavigate();

  const defaultStyle = browse.settings.linkStyle ?? session?.defaultLinkStyle ?? "pages";
  const repo = browse.repo;

  // An empty library means every remembered file is gone — clear the strip.
  useEffect(() => {
    if (ready && recents.length > 0 && browse.totals.files === 0) prune(new Set());
  }, [ready, recents.length, browse.totals.files, prune]);

  const usePages = defaultStyle === "pages";
  const limit = usePages ? PAGES_SITE_LIMIT_BYTES : CDN_PACKAGE_LIMIT_BYTES;
  const pct = Math.min(100, Math.round((browse.totals.bytes / limit) * 100));
  const nearLimit = !usePages && browse.totals.bytes >= CDN_PACKAGE_WARN_BYTES;

  return (
    <AppShell compact>
      <h1 className="sr-only">Naveen Bharat Files</h1>

      {/* Search — the first thing on the screen, like a phone's files app. */}
      <button
        type="button"
        onClick={() => {
          haptic("selection");
          void navigate({ to: "/search", search: { q: "" } });
        }}
        className="flex h-13 w-full items-center gap-3 rounded-2xl border border-input bg-card px-4 text-left shadow-card transition-colors active:bg-muted/60 [@media(hover:hover)]:hover:border-ring/60"
      >
        <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
        <span className="truncate text-[15px] text-muted-foreground">File ya folder dhoondho…</span>
      </button>

      {/* Recent */}
      {ready && recents.length > 0 ? (
        <section className="mt-6">
          <div className="mb-2.5 flex items-end justify-between gap-3 px-1">
            <div>
              <h2 className="flex items-center gap-1.5 text-[15px] font-semibold text-foreground">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Abhi dekha
              </h2>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">Sirf is phone par yaad rahta hai.</p>
            </div>
            <Button
              variant="ghost"
              className="h-8 shrink-0 rounded-full px-2.5 text-[13px] text-muted-foreground"
              onClick={() => {
                haptic("selection");
                clear();
              }}
            >
              <X className="h-3.5 w-3.5" />
              Hatao
            </Button>
          </div>
          <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {recents.map((r) => (
              <li key={r.path} className="w-40 shrink-0 snap-start sm:w-44">
                <Link
                  to="/v/$"
                  params={{ _splat: r.path }}
                  onClick={() => haptic("selection")}
                  className="flex h-full flex-col rounded-2xl border border-border bg-card p-3 shadow-card transition-colors active:bg-muted/60 [@media(hover:hover)]:hover:border-ring/50"
                >
                  {r.kind === "image" ? (
                    <img
                      src={buildLink("cdn", r.path, { repo })}
                      alt=""
                      loading="lazy"
                      className="mb-2.5 aspect-[4/3] w-full rounded-xl bg-muted object-cover"
                    />
                  ) : (
                    <span className="mb-2.5 flex aspect-[4/3] w-full items-center justify-center rounded-xl bg-muted/70">
                      <KindIcon kind={r.kind} size="lg" />
                    </span>
                  )}
                  <span className="line-clamp-2 text-[13.5px] font-medium leading-snug text-foreground">{r.title ?? r.name}</span>
                  <span className="mt-1 text-[12px] text-muted-foreground tabular-nums">{formatBytes(r.size)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Categories */}
      {browse.categories.length > 0 ? (
        <section className="mt-6">
          <SectionHead title="File ke type se" hint="Ek tap mein poori library ka ek type" />
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {browse.categories.map((c) => (
              <li key={c.kind}>
                <Link
                  to="/c/$kind"
                  params={{ kind: c.kind }}
                  onClick={() => haptic("selection")}
                  className="flex h-full items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card transition-colors active:bg-muted/60 [@media(hover:hover)]:hover:border-ring/50"
                >
                  <KindIcon kind={c.kind} />
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-medium text-foreground">{KIND_TITLE[c.kind]}</span>
                    <span className="block truncate text-[12px] text-muted-foreground tabular-nums">
                      {c.count} file{c.count === 1 ? "" : "s"} · {formatBytes(c.bytes)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Collections (top-level folders) */}
      <section className="mt-6">
        <SectionHead
          title="Collections"
          hint={`${browse.totals.folders} folder${browse.totals.folders === 1 ? "" : "s"} sabse upar`}
          action={
            <Link
              to="/files"
              className="pressable inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[13px] font-medium text-primary"
            >
              Saare
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        {browse.collections.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/60 px-5 py-8 text-center">
            <p className="text-[15px] font-medium text-foreground">Abhi koi folder nahi hai.</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {isOwner ? "Library kholo aur pehla folder banao." : "Owner jaldi hi files add karega."}
            </p>
            <Button asChild className="pressable mt-4 h-11 rounded-lg px-5">
              <Link to="/files">Library kholo</Link>
            </Button>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {browse.collections.map((f) => (
              <li key={f.path}>
                <Link
                  to="/f/$"
                  params={{ _splat: f.path }}
                  onClick={() => haptic("selection")}
                  className="flex h-full flex-col rounded-2xl border border-border bg-card p-3 shadow-card transition-colors active:bg-muted/60 [@media(hover:hover)]:hover:border-ring/50"
                >
                  {f.cover ? (
                    <img
                      src={buildLink("cdn", f.cover, { repo })}
                      alt=""
                      loading="lazy"
                      className="mb-2.5 aspect-[4/3] w-full rounded-xl bg-muted object-cover"
                    />
                  ) : (
                    <span className="mb-2.5 flex aspect-[4/3] w-full items-center justify-center rounded-xl bg-muted/70">
                      <KindIcon kind="folder" size="lg" />
                    </span>
                  )}
                  <span className="line-clamp-2 text-[14px] font-medium leading-snug text-foreground">{f.title ?? f.name}</span>
                  <span className="mt-1 text-[12px] text-muted-foreground tabular-nums">
                    {f.folderCount ? `${f.folderCount} folder${f.folderCount === 1 ? "" : "s"} · ` : ""}
                    {f.fileCount} file{f.fileCount === 1 ? "" : "s"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Storage */}
      <section className="mt-6">
        <SectionHead title="Storage" hint={usePages ? "GitHub Pages par" : "jsDelivr CDN par"} />
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-kind-folder text-kind-folder-foreground">
              <HardDrive className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium text-foreground tabular-nums">
                {formatBytes(browse.totals.bytes)} <span className="text-muted-foreground">/ {formatBytes(limit)}</span>
              </p>
              <p className="text-[12.5px] text-muted-foreground tabular-nums">
                {browse.totals.files} file{browse.totals.files === 1 ? "" : "s"} · {browse.totals.folders} collection
                {browse.totals.folders === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted" role="presentation">
            <div
              className={cn("h-full rounded-full transition-[width]", nearLimit ? "bg-destructive" : "bg-primary")}
              style={{ width: `${Math.max(2, pct)}%` }}
            />
          </div>
          <p className="mt-1.5 text-[12px] text-muted-foreground tabular-nums">{pct}% bhara</p>

          <DeliveryHealthCard variant="compact" className="mt-3 border-t border-border pt-3" />

          {nearLimit ? (
            <p className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">
              CDN ki 50 MB limit paas hai — Settings se GitHub Pages link chalu karke aage bhi links chalte rakho.
            </p>
          ) : null}

          {browse.largest.length > 0 ? (
            <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
              {browse.largest.slice(0, 3).map((f) => (
                <li key={f.path} className="flex items-center gap-2">
                  <Link
                    to="/v/$"
                    params={{ _splat: f.path }}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1"
                  >
                    <KindIcon kind={f.kind} size="sm" />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{f.name}</span>
                    <span className="shrink-0 text-[12px] text-muted-foreground tabular-nums">{formatBytes(f.size)}</span>
                  </Link>
                  <CopyLinkButton path={f.path} repo={repo} commit={browse.headSha} style={defaultStyle} />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      <div className="mt-6 flex justify-center pb-2">
        <Button asChild variant="outline" className="pressable h-11 rounded-full px-5">
          <Link to="/files">
            <FolderOpen className="h-4 w-4" />
            Poori library kholo
          </Link>
        </Button>
      </div>
    </AppShell>
  );
}
