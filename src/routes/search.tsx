import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Search as SearchIcon, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { AppShell } from "@/components/library/AppShell";
import { CopyLinkButton } from "@/components/library/CopyLinkButton";
import { KindIcon, extBadge } from "@/components/library/KindIcon";
import { EmptyState, RowSkeleton } from "@/components/library/states";
import { Button } from "@/components/ui/button";
import { useOwner } from "@/hooks/useOwner";
import type { SearchHit } from "@/lib/library-types";
import { haptic } from "@/lib/haptics";
import { formatBytes } from "@/lib/paths";
import { searchQuery } from "@/lib/queries";
import { APP_NAME } from "@/lib/storage-config";

export const Route = createFileRoute("/search")({
  validateSearch: (s: Record<string, unknown>) => ({ q: typeof s["q"] === "string" ? s["q"].slice(0, 120) : "" }),
  head: () => ({
    meta: [
      { title: `Search — ${APP_NAME}` },
      { name: "description", content: "Poori library mein file ya folder ke naam se dhoondho." },
      { property: "og:title", content: `Search — ${APP_NAME}` },
      { property: "og:description", content: "Poori library mein file ya folder ke naam se dhoondho." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q } = Route.useSearch();
  const navigate = useNavigate({ from: "/search" });
  const { session } = useOwner();
  const [text, setText] = useState(q);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText(q);
  }, [q]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounce URL updates so the query key (and server call) settles.
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (text.trim() !== q) void navigate({ search: { q: text.trim() }, replace: true });
    }, 250);
    return () => window.clearTimeout(t);
  }, [text, q, navigate]);

  const results = useQuery(searchQuery(q));
  const grouped = useMemo(() => {
    const map = new Map<string, SearchHit[]>();
    for (const hit of results.data ?? []) {
      const arr = map.get(hit.folder) ?? [];
      arr.push(hit);
      map.set(hit.folder, arr);
    }
    return [...map.entries()];
  }, [results.data]);

  const repo = session?.repo;
  const style = session?.defaultLinkStyle ?? "pages";
  const tooShort = q.trim().length < 2;

  return (
    <AppShell compact>
      <h1 className="sr-only">Search</h1>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="File ya folder ka naam…"
          className="h-13 w-full rounded-2xl border border-input bg-card py-3.5 pl-12 pr-12 text-base outline-none shadow-card transition-colors placeholder:text-muted-foreground/80 focus:border-ring focus:ring-2 focus:ring-ring/25"
          aria-label="Search library"
          enterKeyHint="search"
          autoComplete="off"
        />
        {text ? (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 h-9 w-9 -translate-y-1/2 rounded-full"
            aria-label="Clear"
            onClick={() => {
              haptic("selection");
              setText("");
              inputRef.current?.focus();
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <div className="mt-5">
        {tooShort ? (
          <p className="px-1 text-sm text-muted-foreground">Kam se kam 2 akshar likho — naam, subject ya chapter.</p>
        ) : results.isPending ? (
          <RowSkeleton rows={5} />
        ) : results.isError ? (
          <EmptyState title="Search abhi nahi chal paayi." hint={results.error.message} />
        ) : grouped.length === 0 ? (
          <EmptyState title={`"${q}" ke liye kuch nahi mila.`} hint="Spelling badal kar dekho, ya folder se browse karo." />
        ) : (
          <div className="space-y-5">
            <p className="px-1 text-[13px] text-muted-foreground tabular-nums">
              {results.data.length} result{results.data.length === 1 ? "" : "s"}
            </p>
            {grouped.map(([folder, hits]) => (
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
                            {file.title ? (
                              <>
                                <span className="mx-1.5 opacity-60">·</span>
                                {file.name}
                              </>
                            ) : null}
                          </span>
                        </span>
                      </Link>
                      {repo ? (
                        <div className="pr-1.5">
                          <CopyLinkButton path={file.path} repo={repo} style={style} />
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
