import type { LucideIcon } from "lucide-react";
import { FolderOpen, RefreshCw, WifiOff } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function EmptyState({
  icon: Icon = FolderOpen,
  title,
  hint,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-kind-folder text-kind-folder-foreground">
        <Icon className="h-7 w-7" strokeWidth={1.75} />
      </span>
      <p className="mt-4 text-base font-medium text-foreground">{title}</p>
      {hint ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{hint}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-border bg-card px-6 py-12 text-center shadow-card">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-kind-pdf text-kind-pdf-foreground">
        <WifiOff className="h-7 w-7" strokeWidth={1.75} />
      </span>
      <p className="mt-4 text-base font-medium text-foreground">Library load nahi ho paayi</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>
      {onRetry ? (
        <Button onClick={onRetry} className="pressable mt-5 h-11 rounded-lg px-5">
          <RefreshCw className="h-4 w-4" />
          Dobara try karo
        </Button>
      ) : null}
    </div>
  );
}

export function RowSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-border px-3 py-3 last:border-b-0 sm:px-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function GridSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-card p-3 shadow-card">
          <Skeleton className="aspect-[4/3] w-full rounded-xl" />
          <Skeleton className="mt-3 h-4 w-3/4" />
          <Skeleton className="mt-2 h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}

export function FolderPageSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-5 w-40" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-32" />
      </div>
      <RowSkeleton rows={7} />
    </div>
  );
}
