import {
  File as FileIcon,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType2,
  Folder,
  Presentation,
} from "lucide-react";

import type { FileKind } from "@/lib/paths";
import { cn } from "@/lib/utils";

type Kind = FileKind | "folder";

const ICONS: Record<Kind, typeof FileIcon> = {
  pdf: FileText,
  image: FileImage,
  doc: FileType2,
  sheet: FileSpreadsheet,
  slides: Presentation,
  text: FileText,
  other: FileIcon,
  folder: Folder,
};

const TINT: Record<Kind, string> = {
  pdf: "bg-kind-pdf text-kind-pdf-foreground",
  image: "bg-kind-image text-kind-image-foreground",
  doc: "bg-kind-doc text-kind-doc-foreground",
  sheet: "bg-kind-sheet text-kind-sheet-foreground",
  slides: "bg-kind-pdf text-kind-pdf-foreground",
  text: "bg-kind-other text-kind-other-foreground",
  other: "bg-kind-other text-kind-other-foreground",
  folder: "bg-kind-folder text-kind-folder-foreground",
};

interface Props {
  kind: Kind;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/** Tinted square tile with the file-type icon — the visual anchor for every row and card. */
export function KindIcon({ kind, size = "md", className }: Props) {
  const Icon = ICONS[kind];
  const box = size === "sm" ? "h-8 w-8 rounded-md" : size === "lg" ? "h-14 w-14 rounded-xl" : "h-10 w-10 rounded-lg";
  const icon = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-7 w-7" : "h-5 w-5";
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center", box, TINT[kind], className)} aria-hidden>
      <Icon className={icon} strokeWidth={1.75} />
    </span>
  );
}

/** Small uppercase file-type label, e.g. "PDF". */
export function extBadge(name: string): string {
  const i = name.lastIndexOf(".");
  if (i <= 0) return "FILE";
  return name.slice(i + 1).toUpperCase().slice(0, 5);
}
