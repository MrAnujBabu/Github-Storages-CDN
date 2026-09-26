import { Link } from "@tanstack/react-router";
import { EyeOff } from "lucide-react";

import type { LibraryItem } from "@/lib/library-types";
import { buildLink, type LinkStyle } from "@/lib/links";
import { formatBytes } from "@/lib/paths";
import type { RepoRef } from "@/lib/storage-config";
import { haptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";

import { CopyLinkButton } from "./CopyLinkButton";
import { ItemMenu, type ItemAction } from "./ItemMenu";
import { SelectMark } from "./ItemRow";
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

/** Grid card: cover image for photos/folders with images, a paper tile for documents. */
export function ItemCard({ item, repo, commit, defaultStyle, isOwner, onAction, selecting, selected, onToggle }: Props) {
  const isFile = item.type === "file";
  const title = item.title ?? item.name;
  const cover = isFile ? (item.kind === "image" ? item.path : null) : (item.cover ?? null);

  const preview = cover ? (
    <img
      src={buildLink("cdn", cover, { repo })}
      alt=""
      loading="lazy"
      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
    />
  ) : (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_30%_20%,var(--color-card),transparent_60%)]">
      <KindIcon kind={isFile ? item.kind : "folder"} size="lg" />
      {isFile ? <span className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{extBadge(item.name)}</span> : null}
    </div>
  );

  const linkProps = isFile ? { to: "/v/$" as const, params: { _splat: item.path } } : { to: "/f/$" as const, params: { _splat: item.path } };

  const caption = (
    <div className="px-3 pb-2 pt-3">
      <p className="flex items-center gap-1.5 text-[14px] font-medium leading-snug text-foreground">
        <span className="line-clamp-2">{title}</span>
        {item.hidden ? <EyeOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : null}
      </p>
      <p className="mt-0.5 text-[12px] text-muted-foreground tabular-nums">
        {isFile
          ? formatBytes(item.size)
          : `${item.fileCount} file${item.fileCount === 1 ? "" : "s"}${item.folderCount ? ` · ${item.folderCount} folder${item.folderCount === 1 ? "" : "s"}` : ""}`}
      </p>
    </div>
  );

  if (selecting) {
    return (
      <li
        className={cn(
          "group relative overflow-hidden rounded-2xl border bg-card shadow-card transition-colors",
          selected ? "border-primary ring-2 ring-primary/30" : "border-border",
          item.hidden && !selected && "opacity-80",
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
          className="block w-full text-left"
        >
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
            {preview}
            <SelectMark selected={!!selected} className="absolute left-2 top-2 h-7 w-7 shadow-card" />
          </div>
          {caption}
        </button>
      </li>
    );
  }

  return (
    <li className={cn("group relative overflow-hidden rounded-2xl border border-border bg-card shadow-card", item.hidden && "opacity-80")}>
      <Link {...linkProps} onClick={() => haptic("selection")} className="block">
        <div className="aspect-[4/3] w-full overflow-hidden bg-muted">{preview}</div>
        {caption}
      </Link>
      <div className="flex items-center justify-end gap-0 px-1.5 pb-1.5">
        {isFile ? <CopyLinkButton path={item.path} repo={repo} commit={commit} style={defaultStyle} className="h-10 w-10" /> : null}
        <ItemMenu item={item} repo={repo} commit={commit} defaultStyle={defaultStyle} isOwner={isOwner} onAction={onAction} className="h-10 w-10" />
      </div>
    </li>
  );
}
