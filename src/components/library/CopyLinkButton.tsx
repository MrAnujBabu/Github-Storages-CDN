import { Check, Link2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCopy } from "@/hooks/useCopy";
import { useOrigin } from "@/hooks/useOrigin";
import { buildLink, linkStyleInfo, type LinkStyle } from "@/lib/links";
import type { RepoRef } from "@/lib/storage-config";
import { cn } from "@/lib/utils";

interface Props {
  path: string;
  repo: RepoRef;
  commit?: string | null;
  style: LinkStyle;
  variant?: "icon" | "full";
  className?: string;
  label?: string;
}

/** One tap → the default-style link is on the clipboard. */
export function CopyLinkButton({ path, repo, commit, style, variant = "icon", className, label }: Props) {
  const { copy, copied } = useCopy();
  const origin = useOrigin();
  const info = linkStyleInfo(style);

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    void copy(buildLink(style, path, { repo, commit, origin: origin || window.location.origin }));
  };

  if (variant === "full") {
    return (
      <Button
        type="button"
        onClick={onClick}
        variant={copied ? "secondary" : "default"}
        className={cn("pressable h-11 rounded-lg px-4", className)}
      >
        {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
        {copied ? "Copy ho gaya" : (label ?? "Copy link")}
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          onClick={onClick}
          variant="ghost"
          size="icon"
          aria-label={`${info.label} copy karo`}
          className={cn(
            "pressable h-11 w-11 rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            copied && "bg-accent text-accent-foreground",
            className,
          )}
        >
          {copied ? <Check className="h-[18px] w-[18px]" /> : <Link2 className="h-[18px] w-[18px]" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{copied ? "Copy ho gaya" : `Copy ${info.label}`}</TooltipContent>
    </Tooltip>
  );
}
