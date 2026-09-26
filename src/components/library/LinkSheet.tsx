import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Loader2, RefreshCw, Share2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { useCopy } from "@/hooks/useCopy";
import { useLinkOrigin, useOrigin } from "@/hooks/useOrigin";
import {
  type LinkHealth,
  type LinkStyle,
  buildLink,
  describeHealth,
  htmlEmbed,
  isPreviewOrigin,
  markdownLink,
  orderedLinkStyles,
  withPage,
} from "@/lib/links";
import { prettyName } from "@/lib/paths";
import { linkHealthQuery } from "@/lib/queries";
import { canShare, shareLink } from "@/lib/share";
import type { RepoRef } from "@/lib/storage-config";
import { cn } from "@/lib/utils";

import { ResponsiveDialog } from "./ResponsiveDialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  path: string;
  name: string;
  repo: RepoRef;
  commit?: string | null;
  defaultStyle: LinkStyle;
  /** Current PDF page; when > 1 the sheet also offers a "this page" viewer link. */
  page?: number | undefined;
}

type RowStatus = { kind: "checking" } | { kind: "result"; health: LinkHealth } | { kind: "none" };

const TONE: Record<"ok" | "warn" | "bad" | "muted", string> = {
  ok: "text-primary",
  warn: "text-destructive/90",
  bad: "text-destructive",
  muted: "text-muted-foreground",
};

const DOT: Record<"ok" | "warn" | "bad" | "muted", string> = {
  ok: "bg-primary",
  warn: "bg-destructive/70",
  bad: "bg-destructive",
  muted: "bg-muted-foreground/50",
};

function StatusChip({ status }: { status: RowStatus }) {
  if (status.kind === "none") return null;
  if (status.kind === "checking") {
    return (
      <span className="mt-1 inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        Check ho raha hai…
      </span>
    );
  }
  const d = describeHealth(status.health);
  return (
    <span className={cn("mt-1 inline-flex items-center gap-1.5 text-[12px] font-medium tabular-nums", TONE[d.tone])} role="status">
      <span className={cn("h-1.5 w-1.5 rounded-full", DOT[d.tone])} aria-hidden />
      {d.text}
    </span>
  );
}

function LinkRow({
  label,
  hint,
  value,
  isDefault,
  status = { kind: "none" },
  extra,
}: {
  label: string;
  hint?: string;
  value: string;
  isDefault?: boolean;
  status?: RowStatus;
  extra?: string | undefined;
}) {
  const { copy, copied } = useCopy();
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
            {label}
            {isDefault ? (
              <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">Default</span>
            ) : null}
          </p>
          {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
          <StatusChip status={status} />
          {extra ? <p className="mt-1 text-[12px] text-muted-foreground">{extra}</p> : null}
        </div>
        <Button
          type="button"
          size="sm"
          variant={copied ? "secondary" : "outline"}
          className="pressable h-9 shrink-0 rounded-lg px-3"
          onClick={() => void copy(value)}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Ho gaya" : "Copy"}
        </Button>
      </div>
      <code
        className={cn(
          "mt-2 block select-all overflow-hidden text-ellipsis whitespace-nowrap rounded-md bg-muted px-2 py-1.5 font-mono text-[12px] text-foreground/80",
        )}
        title={value}
      >
        {value}
      </code>
    </div>
  );
}

/**
 * Every link format for one file, each with its own copy button and a live
 * "does this open right now?" check from the server.
 */
export function LinkSheet({ open, onOpenChange, path, name, repo, commit, defaultStyle, page }: Props) {
  const pageOrigin = useOrigin();
  const origin = useLinkOrigin();
  const [showEmbed, setShowEmbed] = useState(false);
  const [shareable, setShareable] = useState(false);
  const [sharing, setSharing] = useState(false);
  useEffect(() => setShareable(canShare()), []);

  const ctx = { repo, commit, origin };
  const primary = buildLink(defaultStyle, path, ctx);
  const title = prettyName(name);
  const styles = useMemo(() => orderedLinkStyles(defaultStyle), [defaultStyle]);

  const health = useQuery({ ...linkHealthQuery(path, commit), enabled: open });
  const results = useMemo(() => new Map((health.data ?? []).map((h) => [h.style, h])), [health.data]);

  // The viewer link is ours: no saved public address + preview host → warn instead of pretending it works.
  const viewerOnPreview = !results.get("viewer")?.url && isPreviewOrigin(origin || pageOrigin);

  const statusFor = (style: LinkStyle): RowStatus => {
    if (style === "viewer" && viewerOnPreview) {
      return { kind: "result", health: { style, url: "", state: "preview", status: null, ms: 0, contentType: null } };
    }
    const r = results.get(style);
    if (r && r.state !== "skipped") return { kind: "result", health: r };
    if (health.isFetching) return { kind: "checking" };
    return { kind: "none" };
  };

  const summary = useMemo(() => {
    if (!health.data) return null;
    const real = health.data.filter((h) => h.state !== "skipped");
    const ok = real.filter((h) => h.state === "ok").length;
    return { ok, total: real.length };
  }, [health.data]);

  const onShare = async () => {
    setSharing(true);
    await shareLink({ title, url: primary, text: `${title} — ${repo.repo}` });
    setSharing(false);
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Sabhi link formats"
      description={name}
      className="sm:max-w-xl"
    >
      <div className="space-y-2 pb-2">
        <div className="flex items-center justify-between gap-2 rounded-xl bg-muted/60 px-3 py-2">
          <p className="min-w-0 text-[12.5px] text-muted-foreground" aria-live="polite">
            {health.isPending && health.isFetching ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Har link live check ho raha hai…
              </span>
            ) : health.isError ? (
              "Check nahi ho paaya — links phir bhi copy kar sakte ho."
            ) : summary ? (
              summary.ok === summary.total ? (
                <span className="font-medium text-foreground">Sab {summary.total} links abhi khul rahe hain ✓</span>
              ) : (
                <span>
                  <span className="font-medium text-foreground">{summary.ok}/{summary.total}</span> links khul rahe hain — neeche har ek ka haal.
                </span>
              )
            ) : (
              "Har link ka live status yahan dikhega."
            )}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            {shareable ? (
              <Button type="button" size="sm" variant="ghost" className="pressable h-9 rounded-lg px-2.5" onClick={() => void onShare()} disabled={sharing}>
                <Share2 className="h-4 w-4" />
                Share
              </Button>
            ) : null}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="pressable h-9 w-9 rounded-lg"
              aria-label="Links dobara check karo"
              onClick={() => void health.refetch()}
              disabled={health.isFetching}
            >
              <RefreshCw className={cn("h-4 w-4", health.isFetching && "animate-spin")} />
            </Button>
          </div>
        </div>

        {viewerOnPreview ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12.5px] text-foreground/85">
            Viewer link abhi <span className="font-medium">preview address</span> par ban raha hai — ye sirf aapko khulega. App ko Publish karke Settings mein
            "App ka public address" set karo, phir ye link sabke liye chalega. Baaki links par koi asar nahi.
          </p>
        ) : null}

        {styles.map((s) => (
          <LinkRow
            key={s.id}
            label={s.label}
            hint={s.hint}
            value={buildLink(s.id, path, ctx)}
            isDefault={s.id === defaultStyle}
            status={statusFor(s.id)}
            extra={
              s.id === "raw" && results.get("raw")?.contentType?.includes("octet-stream")
                ? "Ye link browser mein PDF dikhane ki jagah download karwata hai."
                : undefined
            }
          />
        ))}

        {page && page > 1 ? (
          <LinkRow
            label={`Page ${page} ka viewer link`}
            hint="Khulte hi seedha isi page par pahunchega."
            value={withPage(buildLink("viewer", path, ctx), page)}
            status={statusFor("viewer")}
          />
        ) : null}

        <button
          type="button"
          onClick={() => setShowEmbed((v) => !v)}
          className="w-full rounded-lg px-2 py-2 text-left text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {showEmbed ? "Embed codes chhupao" : "Markdown / HTML embed dikhao"}
        </button>
        {showEmbed ? (
          <>
            <LinkRow label="Markdown" hint="Notes, README ya blog ke liye." value={markdownLink(title, primary)} />
            <LinkRow label="HTML embed" hint="Website mein PDF dikhane ke liye." value={htmlEmbed(primary, title)} />
          </>
        ) : null}
      </div>
    </ResponsiveDialog>
  );
}
