import { CheckSquare, FolderInput, Link2, Square, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  /** Number of items currently selected. */
  count: number;
  /** Number of selectable items on the page. */
  total: number;
  /** How many of the selected items are files (only files have links). */
  fileCount: number;
  isOwner: boolean;
  busy: boolean;
  onSelectAll: () => void;
  onClear: () => void;
  onCopyLinks: () => void;
  onMove: () => void;
  onDelete: () => void;
  onExit: () => void;
}

/**
 * Fixed bottom bar shown while "Select" mode is active. Everyone can copy
 * links for the picked files; owner also gets Move / Delete. Buttons carry
 * their counts so the user always knows what a tap will touch.
 */
export function SelectionBar({ count, total, fileCount, isOwner, busy, onSelectAll, onClear, onCopyLinks, onMove, onDelete, onExit }: Props) {
  const allPicked = total > 0 && count === total;
  return (
    <div
      role="region"
      aria-label="Selection actions"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 backdrop-blur-md safe-bottom"
    >
      <div className="mx-auto w-full max-w-5xl px-4 py-2.5 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={allPicked ? onClear : onSelectAll}
            className="pressable flex h-10 items-center gap-2 rounded-lg px-2 text-[14px] font-medium text-foreground"
            aria-pressed={allPicked}
          >
            {allPicked ? <CheckSquare className="h-5 w-5 text-primary" /> : <Square className="h-5 w-5 text-muted-foreground" />}
            <span className="tabular-nums" aria-live="polite" aria-atomic="true">
              {count === 0 ? "Kuch select karo" : `${count} selected`}
              {total ? <span className="text-muted-foreground"> / {total}</span> : null}
            </span>
          </button>
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" onClick={onExit} aria-label="Selection band karo" disabled={busy}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className={cn("mt-2 grid gap-2", isOwner ? "grid-cols-3" : "grid-cols-1")}>
          <Button
            className="pressable h-11 rounded-xl text-[14px]"
            onClick={onCopyLinks}
            disabled={fileCount === 0 || busy}
          >
            <Link2 className="h-4 w-4" />
            {fileCount > 1 ? `${fileCount} links copy` : "Link copy"}
          </Button>
          {isOwner ? (
            <>
              <Button variant="outline" className="pressable h-11 rounded-xl text-[14px]" onClick={onMove} disabled={count === 0 || busy}>
                <FolderInput className="h-4 w-4" />
                Move
              </Button>
              <Button
                variant="outline"
                className="pressable h-11 rounded-xl text-[14px] text-destructive hover:text-destructive"
                onClick={onDelete}
                disabled={count === 0 || busy}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
