import { Link } from "@tanstack/react-router";
import { Check, ChevronRight, EyeOff } from "lucide-react";

import type { LibraryItem } from "@/lib/library-types";
import { buildLink, type LinkStyle } from "@/lib/links";
import { formatBytes } from "@/lib/paths";
import type { RepoRef } from "@/lib/storage-config";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

import { CopyLinkButton } from "./CopyLinkButton";
import { ItemMenu, type ItemAction } from "./ItemMenu";
import { KindIcon, extBadge } from "./KindIcon";

interface Props {
  item: LibraryItem;
  repo: RepoRef;
  commit: string;
  defaultStyle: LinkStyle;
  isOwner: boolean;
  onAction: (action: ItemAction, item: LibraryItem) => void;
  /** Select mode: tapping toggles the item instead of opening it. */
  selecting?: boolean;
  selected?: boolean;
  onToggle?: (item: LibraryItem) => void;
}

/** Round check mark used in select mode (rows and cards). */
export function SelectMark({ selected, className }: { selected: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
        selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40 bg-card",
        className,
      )}
    >
      {selected ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
    </span>
  );
}

function folderMeta(fileCount: number, folderCount: number, bytes: number): string {
  const parts: string[] = [];
  if (folderCount) parts.push(`${folderCount} folder${folderCount === 1 ? "" : "s"}`);
  parts.push(`${fileCount} file${fileCount === 1 ? "" : "s"}`);
  if (bytes) parts.push(formatBytes(bytes));
  return parts.join(" · ");
}

/** Dense, thumb-friendly list row. The whole row navigates; actions sit on the right. */
export function ItemRow({ item, repo, commit, defaultStyle, isOwner, onAction, selecting, selected, onToggle }: Props) {
  const isFile = item.type === "file";
  const title = item.title ?? item.name;
  const subtitle = item.title ? item.name : undefined;


  const body = (
    <>
      {isFile && item.kind === "image" ? (
        <img
          src={buildLink("cdn", item.path, { repo })}
          alt=""
          loading="lazy"
          width={40}
          height={40}
          className="h-10 w-10 shrink-0 rounded-lg bg-muted object-cover"
        />
      ) : (
        <KindIcon kind={isFile ? item.kind : "folder"} />
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[15px] font-medium text-foreground">{title}</span>
          {item.hidden ? <EyeOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Hidden" /> : null}
        </span>
        <span className="mt-0.5 block truncate text-[12.5px] text-muted-foreground tabular-nums">
          {isFile ? (
            <>
              <span className="font-mono">{extBadge(item.name)}</span>
              <span className="mx-1.5 opacity-60">·</span>
              {formatBytes(item.size)}
              {subtitle ? (
                <>
                  <span className="mx-1.5 opacity-60">·</span>
                  {subtitle}
                </>
              ) : null}
            </>
          ) : (
            <>
              {folderMeta(item.fileCount, item.folderCount, item.bytes)}
              {subtitle ? (
                <>
                  <span className="mx-1.5 opacity-60">·</span>
                  {subtitle}
                </>
              ) : null}
            </>
          )}
        </span>
        {item.note ? <span className="mt-0.5 block truncate text-[12.5px] text-muted-foreground/90">{item.note}</span> : null}
      </span>
    </>
  );

  if (selecting) {
    return (
      <li
        className={cn(
          "group flex items-center gap-1 border-b border-border last:border-b-0 transition-colors",
          selected ? "bg-accent/60" : item.hidden && "bg-muted/40",
        )}
      >
        <button
          type="button"
          role="checkbox"
          aria-checked={!!selected}
          aria-label={`${title} select karo`}
          onClick={() => {
            haptic("selection");
            onToggle?.(item);
          }}
          className="flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2.5 pl-3 pr-3 text-left active:bg-muted/60 sm:pl-4"
        >
          <SelectMark selected={!!selected} />
          {body}
        </button>
      </li>
    );
  }

  return (
    <li
      className={cn(
        "group flex items-center gap-1 border-b border-border last:border-b-0",
        item.hidden && "bg-muted/40",
      )}
    >
      {isFile ? (
        <Link
          to="/v/$"
          params={{ _splat: item.path }}
          onClick={() => haptic("selection")}
          className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-3 pr-1 transition-colors active:bg-muted/60 sm:pl-4 [@media(hover:hover)]:hover:bg-muted/50"
        >
          {body}
        </Link>
      ) : (
        <Link
          to="/f/$"
          params={{ _splat: item.path }}
          onClick={() => haptic("selection")}
          className="flex min-w-0 flex-1 items-center gap-3 py-2.5 pl-3 pr-1 transition-colors active:bg-muted/60 sm:pl-4 [@media(hover:hover)]:hover:bg-muted/50"
        >
          {body}
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
        </Link>
      )}
      <div className="flex shrink-0 items-center pr-1.5">
        {isFile ? <CopyLinkButton path={item.path} repo={repo} commit={commit} style={defaultStyle} /> : null}
        <ItemMenu item={item} repo={repo} commit={commit} defaultStyle={defaultStyle} isOwner={isOwner} onAction={onAction} />
      </div>
    </li>
  );
}
