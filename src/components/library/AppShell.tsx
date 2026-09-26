import { Link, useNavigate } from "@tanstack/react-router";
import { LogIn, Search, Settings2 } from "lucide-react";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";

import nbLogo from "@/assets/nb-logo.png";
import { Button } from "@/components/ui/button";
import { useOwner } from "@/hooks/useOwner";
import { cn } from "@/lib/utils";

interface Props {
  children: ReactNode;
  /** Sticky bottom action bar (owner tools) — mobile only, rendered with safe-area padding. */
  bottomBar?: ReactNode;
  /** A self-positioned fixed footer (e.g. the selection bar) shown on every screen size; main gets extra bottom room. */
  footer?: ReactNode;
  /** Hide the search box (viewer / sign-in pages). */
  compact?: boolean;
  className?: string;
}

export function AppShell({ children, bottomBar, footer, compact, className }: Props) {
  const { isOwner, loading } = useOwner();
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  // Tell the toaster (see styles.css) how much of the bottom edge is covered, so toasts rise above the bars.
  const barKind = footer ? "selection" : bottomBar ? "tools" : "";
  useEffect(() => {
    const el = document.documentElement;
    if (barKind) el.setAttribute("data-bottom-bar", barKind);
    else el.removeAttribute("data-bottom-bar");
    return () => el.removeAttribute("data-bottom-bar");
  }, [barKind]);

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    const query = q.trim();
    if (query.length < 2) return;
    void navigate({ to: "/search", search: { q: query } });
  };

  return (
    <div className={cn("flex min-h-dvh flex-col bg-background", className)}>
      <header className="safe-top sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur-md">
        <div className="mx-auto grid h-14 w-full max-w-5xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-4 sm:h-16 sm:px-6">
          <Link to="/" className="pressable flex min-w-0 items-center gap-2.5 rounded-lg py-1 pr-2" aria-label="Naveen Bharat Files home">
            <img src={nbLogo} alt="" width={32} height={32} className="h-8 w-8 shrink-0 rounded-md object-contain" />
            <span className="hidden min-w-0 flex-col leading-tight min-[380px]:flex">
              <span className="font-display text-[17px] font-semibold tracking-tight text-foreground">Naveen Bharat</span>
              <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Files</span>
            </span>
          </Link>

          {!compact ? (
            <form onSubmit={submitSearch} className="mx-auto hidden w-full max-w-md items-center sm:flex" role="search">
              <label className="relative w-full">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Poori library mein dhoondho…"
                  className="h-10 w-full rounded-full border border-input bg-card pl-9 pr-4 text-base outline-none transition-colors placeholder:text-muted-foreground/80 focus:border-ring focus:ring-2 focus:ring-ring/25 md:text-sm"
                  aria-label="Search library"
                  enterKeyHint="search"
                />
              </label>
            </form>
          ) : (
            <span />
          )}

          <div className="flex items-center justify-end gap-1">
            {!compact ? (
              <Button asChild variant="ghost" size="icon" className="h-11 w-11 rounded-full sm:hidden" aria-label="Search">
                <Link to="/search" search={{ q: "" }}>
                  <Search className="h-5 w-5" />
                </Link>
              </Button>
            ) : null}
            {loading ? (
              <span className="h-11 w-11" aria-hidden />
            ) : isOwner ? (
              <Button asChild variant="ghost" size="icon" className="h-11 w-11 rounded-full" aria-label="Settings">
                <Link to="/settings">
                  <Settings2 className="h-5 w-5" />
                </Link>
              </Button>
            ) : (
              <Button asChild variant="ghost" className="h-11 rounded-full px-3 text-sm sm:px-4">
                <Link to="/sign-in">
                  <LogIn className="h-4 w-4" />
                  <span>Owner sign in</span>
                </Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main
        className={cn(
          "mx-auto w-full max-w-5xl flex-1 px-4 pt-4 sm:px-6 sm:pt-6",
          footer
            ? "pb-[calc(132px+env(safe-area-inset-bottom))]"
            : bottomBar
              ? "pb-[calc(88px+env(safe-area-inset-bottom))] sm:pb-16"
              : "pb-16",
        )}
      >
        {children}
      </main>

      {footer}

      {bottomBar && !footer ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/90 backdrop-blur-md safe-bottom sm:hidden">
          <div className="mx-auto flex w-full max-w-5xl items-center gap-2 px-4 py-3 sm:px-6">{bottomBar}</div>
        </div>
      ) : null}
    </div>
  );
}

export function PageTitle({ title, note, meta, actions }: { title: string; note?: string | undefined; meta?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-semibold text-foreground sm:text-3xl">{title}</h1>
        {note ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{note}</p> : null}
        {meta ? <div className="mt-1.5 text-[13px] text-muted-foreground tabular-nums">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
