import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, FileText, History, RefreshCw } from "lucide-react";

import { getUploadHistory } from "@/lib/library.functions";
import { Button } from "@/components/ui/button";

function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("hi-IN", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Upload History — Naveen Bharat Files" },
      { name: "description", content: "Kaunsi file kab, kis repo me upload hui — owner history." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["upload-history"],
    queryFn: () => getUploadHistory(),
    retry: false,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <History className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Upload History</h1>
        </div>
        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => void refetch()} aria-label="Refresh">
          <RefreshCw className={isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">History load ho rahi hai…</p>}

      {error && (
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          {(error as Error).message.includes("sign in")
            ? "History sirf owner dekh sakta hai — pehle sign in karo."
            : (error as Error).message}
        </div>
      )}

      {data && data.length === 0 && (
        <p className="text-sm text-muted-foreground">Abhi tak koi upload history nahi — nayi uploads yahan dikhengi.</p>
      )}

      {data && data.length > 0 && (
        <ul className="space-y-2">
          {data.map((row) => (
            <li key={row.id} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{row.file_name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatBytes(row.size_bytes)} · {row.repo}
                      {row.folder ? ` · ${row.folder}` : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(row.created_at)}</p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button asChild variant="ghost" size="icon" className="h-8 w-8" aria-label="CDN link kholo">
                    <a href={row.cdn_url} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        Files GitHub repo me rehti hain; ye list sirf record ke liye Supabase me hai.{" "}
        <Link to="/repos" className="text-primary underline-offset-2 hover:underline">Storage repos dekho</Link>
      </p>
    </div>
  );
}
