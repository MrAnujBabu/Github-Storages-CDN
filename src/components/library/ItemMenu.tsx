import { Link } from "@tanstack/react-router";
import {
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FolderInput,
  Github,
  Link2,
  MoreHorizontal,
  Pencil,
  Tag,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCopy } from "@/hooks/useCopy";
import { useOrigin } from "@/hooks/useOrigin";
import type { LibraryItem } from "@/lib/library-types";
import { buildLink, type LinkStyle } from "@/lib/links";
import type { RepoRef } from "@/lib/storage-config";
import { haptic } from "@/lib/haptics";

export type ItemAction = "rename" | "move" | "delete" | "label" | "hide" | "links";

interface Props {
  item: LibraryItem;
  repo: RepoRef;
  commit?: string | null;
  defaultStyle: LinkStyle;
  isOwner: boolean;
  onAction: (action: ItemAction, item: LibraryItem) => void;
  className?: string;
}

/** The "…" menu on every row/card. Read-only actions for visitors, editing for the owner. */
export function ItemMenu({ item, repo, commit, defaultStyle, isOwner, onAction, className }: Props) {
  const { copy } = useCopy();
  const origin = useOrigin();
  const isFile = item.type === "file";
  const ctx = { repo, commit, origin: origin || (typeof window !== "undefined" ? window.location.origin : "") };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="More actions"
          className={`pressable h-11 w-11 rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground ${className ?? ""}`}
          onClick={(e) => {
            e.stopPropagation();
            haptic("selection");
          }}
        >
          <MoreHorizontal className="h-[18px] w-[18px]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 rounded-xl p-1.5 shadow-float" onClick={(e) => e.stopPropagation()}>
        {isFile ? (
          <>
            <DropdownMenuItem className="h-10 rounded-lg" onSelect={() => void copy(buildLink(defaultStyle, item.path, ctx))}>
              <Link2 className="h-4 w-4" />
              Copy link
            </DropdownMenuItem>
            <DropdownMenuItem className="h-10 rounded-lg" onSelect={() => onAction("links", item)}>
              <Link2 className="h-4 w-4 opacity-0" />
              Sabhi link formats…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="h-10 rounded-lg">
              <Link to="/v/$" params={{ _splat: item.path }}>
                <Eye className="h-4 w-4" />
                Viewer mein kholo
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="h-10 rounded-lg">
              <a href={buildLink("cdn", item.path, ctx)} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                CDN par kholo
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="h-10 rounded-lg">
              <a href={buildLink("cdn", item.path, ctx)} download={item.name} target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4" />
                Download
              </a>
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem asChild className="h-10 rounded-lg">
            <Link to="/f/$" params={{ _splat: item.path }}>
              <Eye className="h-4 w-4" />
              Folder kholo
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild className="h-10 rounded-lg">
          <a
            href={
              isFile
                ? buildLink("github", item.path, ctx)
                : `https://github.com/${repo.owner}/${repo.repo}/tree/${repo.branch}/${item.path.split("/").map(encodeURIComponent).join("/")}`
            }
            target="_blank"
            rel="noopener noreferrer"
          >
            <Github className="h-4 w-4" />
            GitHub par dekho
          </a>
        </DropdownMenuItem>

        {isOwner ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="h-10 rounded-lg" onSelect={() => onAction("rename", item)}>
              <Pencil className="h-4 w-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem className="h-10 rounded-lg" onSelect={() => onAction("move", item)}>
              <FolderInput className="h-4 w-4" />
              Move to…
            </DropdownMenuItem>
            <DropdownMenuItem className="h-10 rounded-lg" onSelect={() => onAction("label", item)}>
              <Tag className="h-4 w-4" />
              Title aur note
            </DropdownMenuItem>
            <DropdownMenuItem className="h-10 rounded-lg" onSelect={() => onAction("hide", item)}>
              {item.hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              {item.hidden ? "Sabko dikhao" : "Visitors se chhupao"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="h-10 rounded-lg text-destructive focus:bg-destructive/10 focus:text-destructive"
              onSelect={() => onAction("delete", item)}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
