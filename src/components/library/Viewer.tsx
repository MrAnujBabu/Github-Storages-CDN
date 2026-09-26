import { useSuspenseQuery } from "@tanstack/react-query";
import { ClientOnly, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ChevronLeft, ChevronRight, Download, ExternalLink, Github, Link2, MoreHorizontal } from "lucide-react";
import { Component, type ReactNode, Suspense, lazy, useEffect, useState } from "react";

import nbLogo from "@/assets/nb-logo.png";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useOwner } from "@/hooks/useOwner";
import { rememberRecent } from "@/hooks/useRecents";
import { useOrigin } from "@/hooks/useOrigin";
import { buildLink } from "@/lib/links";
import { haptic } from "@/lib/haptics";
import { formatBytes, kindLabel } from "@/lib/paths";
import { fileQuery } from "@/lib/queries";

import { CopyLinkButton } from "./CopyLinkButton";
import { KindIcon } from "./KindIcon";
import { LinkSheet } from "./LinkSheet";

const PdfViewer = lazy(() => import("./PdfViewer"));

function ViewerFallback() {
  return (
    <div className="flex flex-1 items-center justify-center bg-muted/60 p-6">
      <div className="w-full max-w-2xl animate-pulse rounded-md bg-card p-8 shadow-card" style={{ aspectRatio: "1 / 1.3" }}>
        <div className="h-5 w-2/3 rounded bg-muted" />
        <div className="mt-4 h-3 w-full rounded bg-muted" />
        <div className="mt-2 h-3 w-11/12 rounded bg-muted" />
      </div>
    </div>
  );
}

/** Keeps a PDF engine crash inside the viewer area so the header and links stay usable. */
class PdfBoundary extends Component<{ href: string; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: unknown) {
    console.error("[viewer] pdf engine crashed", error);
  }
  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex flex-1 items-center justify-center bg-muted/60 p-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-card">
          <p className="text-base font-medium text-foreground">Is browser mein PDF viewer nahi chala</p>
          <p className="mt-1 text-sm text-muted-foreground">File theek hai — CDN link se seedha kholo ya download karo.</p>
          <a
            href={this.props.href}
            target="_blank"
            rel="noopener noreferrer"
            className="pressable mt-4 inline-flex h-11 items-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground"
          >
            CDN par kholo
          </a>
        </div>
      </div>
    );
  }
}

export function Viewer({ path }: { path: string }) {
  const { data } = useSuspenseQuery(fileQuery(path));
  const { session } = useOwner();
  const origin = useOrigin();
  const navigate = useNavigate();
  const [linksOpen, setLinksOpen] = useState(false);

  // Loader already threw notFound() when null; keep a guard for cache races.
  if (!data) return null;
  const { file, repo, headSha, prev, next, crumbs } = data;
  const defaultStyle = data.settings.linkStyle ?? session?.defaultLinkStyle ?? "pages";
  const ctx = { repo, commit: headSha, origin };
  const cdn = buildLink("cdn", file.path, ctx);
  const folder = crumbs[crumbs.length - 1];
  const title = file.title ?? file.name;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.key === "ArrowRight" && next) void navigate({ to: "/v/$", params: { _splat: next.path } });
      if (e.altKey && e.key === "ArrowLeft" && prev) void navigate({ to: "/v/$", params: { _splat: prev.path } });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, navigate]);

  // Feeds the home screen's "Abhi dekha" strip (this browser only).
  useEffect(() => {
    rememberRecent({
      path: file.path,
      name: file.name,
      kind: file.kind,
      size: file.size,
      ...(file.title ? { title: file.title } : {}),
    });
  }, [file.path, file.name, file.kind, file.size, file.title]);

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="safe-top z-30 border-b border-border/80 bg-background/95 backdrop-blur">
        <div className="mx-auto grid h-14 w-full max-w-6xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1 px-2 sm:h-16 sm:gap-2 sm:px-4">
          <div className="flex items-center">
            {folder && folder.path ? (
              <Button asChild variant="ghost" size="icon" className="h-11 w-11 rounded-full" aria-label="Folder par wapas">
                <Link to="/f/$" params={{ _splat: folder.path }} onClick={() => haptic("selection")}>
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button asChild variant="ghost" size="icon" className="h-11 w-11 rounded-full" aria-label="Library par wapas">
                <Link to="/files" onClick={() => haptic("selection")}>
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
            )}
            <Link to="/" className="hidden items-center sm:flex" aria-label="Naveen Bharat Files">
              <img src={nbLogo} alt="" width={28} height={28} className="h-7 w-7 rounded-md object-contain" />
            </Link>
          </div>

          <div className="flex min-w-0 items-center gap-2.5">
            <KindIcon kind={file.kind} size="sm" className="hidden sm:inline-flex" />
            <div className="min-w-0">
              <h1 className="truncate text-[15px] font-semibold leading-tight text-foreground sm:text-base">{title}</h1>
              <p className="truncate text-[12px] text-muted-foreground tabular-nums">
                {kindLabel(file.kind)} · {formatBytes(file.size)}
                {folder?.path ? <> · {folder.name}</> : null}
                {file.title ? <> · {file.name}</> : null}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-0.5">
            {prev || next ? (
              <div className="hidden items-center md:flex">
                <Button asChild={!!prev} variant="ghost" size="icon" className="h-10 w-10 rounded-full" aria-label="Pichli file" disabled={!prev}>
                  {prev ? (
                    <Link to="/v/$" params={{ _splat: prev.path }}>
                      <ChevronLeft className="h-4 w-4" />
                    </Link>
                  ) : (
                    <ChevronLeft className="h-4 w-4" />
                  )}
                </Button>
                <Button asChild={!!next} variant="ghost" size="icon" className="h-10 w-10 rounded-full" aria-label="Agli file" disabled={!next}>
                  {next ? (
                    <Link to="/v/$" params={{ _splat: next.path }}>
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ) : null}
            <CopyLinkButton path={file.path} repo={repo} commit={headSha} style={defaultStyle} variant="full" className="hidden h-10 sm:inline-flex" />
            <CopyLinkButton path={file.path} repo={repo} commit={headSha} style={defaultStyle} className="sm:hidden" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full" aria-label="More">
                  <MoreHorizontal className="h-[18px] w-[18px]" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 rounded-xl p-1.5 shadow-float">
                <DropdownMenuItem className="h-10 rounded-lg" onSelect={() => setLinksOpen(true)}>
                  <Link2 className="h-4 w-4" />
                  Sabhi link formats…
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="h-10 rounded-lg">
                  <a href={cdn} download={file.name} target="_blank" rel="noopener noreferrer">
                    <Download className="h-4 w-4" />
                    Download
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="h-10 rounded-lg">
                  <a href={cdn} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    CDN par kholo
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="h-10 rounded-lg">
                  <a href={buildLink("github", file.path, ctx)} target="_blank" rel="noopener noreferrer">
                    <Github className="h-4 w-4" />
                    GitHub par dekho
                  </a>
                </DropdownMenuItem>
                {prev || next ? (
                  <>
                    <DropdownMenuSeparator />
                    {prev ? (
                      <DropdownMenuItem asChild className="h-10 rounded-lg">
                        <Link to="/v/$" params={{ _splat: prev.path }}>
                          <ChevronLeft className="h-4 w-4" />
                          <span className="truncate">Pichli: {prev.name}</span>
                        </Link>
                      </DropdownMenuItem>
                    ) : null}
                    {next ? (
                      <DropdownMenuItem asChild className="h-10 rounded-lg">
                        <Link to="/v/$" params={{ _splat: next.path }}>
                          <ChevronRight className="h-4 w-4" />
                          <span className="truncate">Agli: {next.name}</span>
                        </Link>
                      </DropdownMenuItem>
                    ) : null}
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {file.note ? (
        <div className="border-b border-border bg-accent/40 px-4 py-2 text-center text-[13px] text-foreground/85">{file.note}</div>
      ) : null}

      {file.kind === "pdf" ? (
        <ClientOnly fallback={<ViewerFallback />}>
          <Suspense fallback={<ViewerFallback />}>
            <PdfViewer key={file.path} url={cdn} title={title} fallbackHref={cdn} />
          </Suspense>
        </ClientOnly>
      ) : file.kind === "image" ? (
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-muted/60 p-3 sm:p-6">
          <img src={cdn} alt={title} className="max-h-full max-w-full rounded-lg bg-card object-contain shadow-card" />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center bg-muted/60 p-6">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-card">
            <KindIcon kind={file.kind} size="lg" className="mx-auto" />
            <p className="mt-4 text-base font-medium text-foreground">{title}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {kindLabel(file.kind)} browser mein preview nahi hota — download karke kholo.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button asChild className="pressable h-11 rounded-lg px-5">
                <a href={cdn} download={file.name} target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4" />
                  Download ({formatBytes(file.size)})
                </a>
              </Button>
              <CopyLinkButton path={file.path} repo={repo} commit={headSha} style={defaultStyle} variant="full" className="bg-secondary text-secondary-foreground hover:bg-secondary/80" />
            </div>
          </div>
        </div>
      )}

      {/* Mobile prev/next strip */}
      {prev || next ? (
        <div className="grid grid-cols-2 gap-px border-t border-border bg-border safe-bottom md:hidden">
          {prev ? (
            <Link
              to="/v/$"
              params={{ _splat: prev.path }}
              onClick={() => haptic("selection")}
              className="flex h-12 items-center gap-2 bg-background px-3 text-[13px] text-foreground active:bg-muted"
            >
              <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{prev.name}</span>
            </Link>
          ) : (
            <span className="bg-background" />
          )}
          {next ? (
            <Link
              to="/v/$"
              params={{ _splat: next.path }}
              onClick={() => haptic("selection")}
              className="flex h-12 items-center justify-end gap-2 bg-background px-3 text-right text-[13px] text-foreground active:bg-muted"
            >
              <span className="truncate">{next.name}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          ) : (
            <span className="bg-background" />
          )}
        </div>
      ) : null}

      <LinkSheet
        open={linksOpen}
        onOpenChange={setLinksOpen}
        path={file.path}
        name={file.name}
        repo={repo}
        commit={headSha}
        defaultStyle={defaultStyle}
      />
    </div>
  );
}
