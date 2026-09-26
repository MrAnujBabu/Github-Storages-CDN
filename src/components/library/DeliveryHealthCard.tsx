import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Activity, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useOwner } from "@/hooks/useOwner";
import { haptic } from "@/lib/haptics";
import type { DeliveryChannel, DeliveryHealth } from "@/lib/library-types";
import { LINK_STYLES, type LinkStyle } from "@/lib/links";
import { deliveryHealthQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

/**
 * "Is my library reachable right now?" — a few real files probed on every public
 * channel (GitHub Pages, jsDelivr, raw GitHub, Statically) with round-trip times.
 * `variant="full"` is the Settings card; `variant="compact"` is the two-line strip
 * under the storage meter on the home screen.
 */

type Tone = "ok" | "warn" | "bad" | "muted";

const TONE: Record<Tone, string> = {
  ok: "text-primary",
  warn: "text-destructive/90",
  bad: "text-destructive",
  muted: "text-muted-foreground",
};

const DOT: Record<Tone, string> = {
  ok: "bg-primary",
  warn: "bg-destructive/70",
  bad: "bg-destructive",
  muted: "bg-muted-foreground/50",
};

const SHORT_LABEL: Partial<Record<LinkStyle, string>> = {
  pages: "GitHub Pages",
  cdn: "CDN (jsDelivr)",
  raw: "Raw GitHub",
  statically: "Statically",
};

function channelLabel(style: LinkStyle): string {
  return SHORT_LABEL[style] ?? LINK_STYLES.find((s) => s.id === style)?.label ?? style;
}

function describeChannel(c: DeliveryChannel): { text: string; tone: Tone } {
  const ms = c.medianMs != null ? ` · ${c.medianMs} ms` : "";
  if (c.total === 0) return { text: "Check karne ko file nahi", tone: "muted" };
  if (c.state === "ok") return { text: `Sab chal rahe hain${ms}`, tone: "ok" };
  const live = `${c.ok}/${c.total} live`;
  switch (c.state) {
    case "pending":
      return {
        text: c.style === "pages" ? `${live} — nayi file 1 minute me aati hai` : `${live} — baaki abhi index ho rahe`,
        tone: "warn",
      };
    case "blocked":
      return { text: c.style === "cdn" ? `${live} — repo 50 MB se bada, CDN block` : `${live} — block`, tone: "bad" };
    case "down":
      return { text: c.ok > 0 ? `${live}${ms}` : "Jawab nahi aa raha", tone: "bad" };
    default:
      return { text: live, tone: "muted" };
  }
}

function overall(data: DeliveryHealth): { text: string; tone: Tone } {
  const main = data.channels.filter((c) => c.style === "pages" || c.style === "cdn");
  const allOk = main.every((c) => c.state === "ok");
  const anyDown = data.channels.some((c) => c.state === "down" || c.state === "blocked");
  if (allOk) return { text: "Library ke links chal rahe hain", tone: "ok" };
  if (anyDown) return { text: "Kuch links nahi khul rahe", tone: "bad" };
  return { text: "Kuch links abhi live ho rahe hain", tone: "warn" };
}

/** Owners tap through to the full panel in Settings; visitors just see the line (Settings is owner-only). */
function CompactBody({ isOwner, children }: { isOwner: boolean; children: ReactNode }) {
  const cls = "flex min-w-0 flex-1 items-center gap-2 rounded-md";
  return isOwner ? (
    <Link to="/settings" hash="delivery" className={cls}>
      {children}
    </Link>
  ) : (
    <span className={cls}>{children}</span>
  );
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export function DeliveryHealthCard({ variant = "full", className }: { variant?: "full" | "compact"; className?: string }) {
  const q = useQuery(deliveryHealthQuery);
  const { isOwner } = useOwner();
  const refresh = () => {
    haptic("selection");
    void q.refetch();
  };

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-2 text-[12.5px]", className)}>
        <Activity className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        {q.isPending ? (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            Links check ho rahe hain…
          </span>
        ) : q.isError || !q.data ? (
          <button type="button" onClick={refresh} className="text-muted-foreground underline-offset-2 hover:underline">
            Link check nahi hua — dobara try karo
          </button>
        ) : (
          <CompactBody isOwner={isOwner}>
            <span className={cn("truncate font-medium", TONE[overall(q.data).tone])}>{overall(q.data).text}</span>
            <span className="hidden min-w-0 items-center gap-2 text-muted-foreground tabular-nums sm:inline-flex">
              {q.data.channels
                .filter((c) => c.style === "pages" || c.style === "cdn")
                .map((c) => (
                  <span key={c.style} className="inline-flex items-center gap-1">
                    <span className={cn("h-1.5 w-1.5 rounded-full", DOT[describeChannel(c).tone])} aria-hidden />
                    {channelLabel(c.style)}
                    {c.medianMs != null && c.state === "ok" ? ` ${c.medianMs} ms` : ""}
                  </span>
                ))}
            </span>
            {isOwner ? <ChevronRight className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden /> : null}
          </CompactBody>
        )}
      </div>
    );
  }

  return (
    <div id="delivery" className={cn("rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5", className)}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Activity className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-medium text-foreground">Link status</p>
          {q.isPending ? (
            <Skeleton className="mt-1.5 h-4 w-48" />
          ) : q.isError || !q.data ? (
            <p className="mt-0.5 text-[12.5px] text-destructive">Check nahi ho paya — network dekh kar dobara try karo.</p>
          ) : (
            <p className={cn("mt-0.5 text-[12.5px] font-medium", TONE[overall(q.data).tone])} role="status">
              {overall(q.data).text}
              <span className="font-normal text-muted-foreground">
                {" "}
                · {q.data.samples.length} file{q.data.samples.length === 1 ? "" : "s"} par
                {q.data.checkedAt ? ` · ${timeLabel(q.data.checkedAt)}` : ""}
              </span>
            </p>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-full"
          aria-label="Dobara check karo"
          onClick={refresh}
          disabled={q.isFetching}
        >
          <RefreshCw className={cn("h-4 w-4", q.isFetching && "animate-spin")} />
        </Button>
      </div>

      <ul className="mt-4 divide-y divide-border rounded-xl border border-border" aria-label="Har channel ka haal">
        {q.isPending
          ? [0, 1, 2, 3].map((i) => (
              <li key={i} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-32" />
              </li>
            ))
          : q.data?.channels.map((c) => {
              const d = describeChannel(c);
              return (
                <li key={c.style} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <span className="text-[13.5px] text-foreground">{channelLabel(c.style)}</span>
                  <span className={cn("inline-flex items-center gap-1.5 text-right text-[12.5px] font-medium tabular-nums", TONE[d.tone])}>
                    <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT[d.tone])} aria-hidden />
                    {d.text}
                  </span>
                </li>
              );
            })}
      </ul>

      {q.data && q.data.samples.length > 0 ? (
        <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
          Check ki gayi files: {q.data.samples.map((s) => s.name).join(", ")}. Har file ka apna haal “Sabhi link formats” me
          dikhta hai.
        </p>
      ) : null}
    </div>
  );
}
