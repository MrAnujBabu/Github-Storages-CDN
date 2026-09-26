import { useQuery } from "@tanstack/react-query";
import { Check, Folder, Search } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { LibraryItem } from "@/lib/library-types";
import { haptic } from "@/lib/haptics";
import { cleanFileName, cleanFolderName, extensionOf, parentPath } from "@/lib/paths";
import { foldersQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

import { ResponsiveDialog } from "./ResponsiveDialog";

/* ----------------------------- New folder ----------------------------- */

export function NewFolderDialog({
  open,
  onOpenChange,
  parent,
  busy,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  parent: string;
  busy: boolean;
  onSubmit: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState(false);
  useEffect(() => {
    if (open) {
      setName("");
      setSlug(false);
    }
  }, [open]);
  const finalName = cleanFolderName(name, { slug });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!finalName || busy) return;
    haptic("light");
    void onSubmit(finalName);
  };
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Naya folder"
      description={parent ? `Andar: ${parent}` : "Library ke root mein"}
      locked={busy}
      footer={
        <>
          <Button type="button" variant="ghost" className="h-11 rounded-lg" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="new-folder-form" className="pressable h-11 rounded-lg px-5" disabled={!finalName || busy}>
            {busy ? "Ban raha hai…" : "Folder banao"}
          </Button>
        </>
      }
    >
      <form id="new-folder-form" onSubmit={submit} className="space-y-4 pb-2">
        <div className="space-y-1.5">
          <Label htmlFor="new-folder-name">Folder ka naam</Label>
          <Input
            id="new-folder-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="jaise: Physics 12th"
            className="h-11 rounded-lg text-base"
            maxLength={120}
            enterKeyHint="done"
          />
          {finalName && finalName !== name.trim() ? (
            <p className="text-[12.5px] text-muted-foreground">
              Banega: <span className="font-mono text-foreground">{finalName}</span>
            </p>
          ) : null}
        </div>
        <label className="flex items-center justify-between gap-3 rounded-lg border border-input bg-card px-3 py-2.5 text-[13px]">
          <span>
            Naam saaf karo
            <span className="block text-[11px] text-muted-foreground">spaces → hyphen, link chhota rahega</span>
          </span>
          <Switch checked={slug} onCheckedChange={setSlug} />
        </label>
      </form>
    </ResponsiveDialog>
  );
}

/* ------------------------------- Rename ------------------------------- */

export function RenameDialog({
  item,
  onOpenChange,
  busy,
  onSubmit,
}: {
  item: LibraryItem | null;
  onOpenChange: (o: boolean) => void;
  busy: boolean;
  onSubmit: (newName: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  useEffect(() => {
    if (item) setName(item.name);
  }, [item]);
  const isFile = item?.type === "file";
  const finalName = item ? (isFile ? cleanFileName(name) : cleanFolderName(name)) : "";
  const extChanged = isFile && item ? extensionOf(finalName) !== extensionOf(item.name) : false;
  const changed = !!item && finalName !== item.name;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!finalName || !changed || busy) return;
    haptic("light");
    void onSubmit(finalName);
  };

  return (
    <ResponsiveDialog
      open={!!item}
      onOpenChange={onOpenChange}
      title={isFile ? "File rename karo" : "Folder rename karo"}
      description={
        isFile
          ? "Purana link band ho jayega — naya link dobara share karna hoga."
          : "Folder ke andar ki sabhi files ke links badal jayenge."
      }
      locked={busy}
      footer={
        <>
          <Button type="button" variant="ghost" className="h-11 rounded-lg" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="rename-form" className="pressable h-11 rounded-lg px-5" disabled={!changed || busy}>
            {busy ? "Rename ho raha hai…" : "Rename karo"}
          </Button>
        </>
      }
    >
      <form id="rename-form" onSubmit={submit} className="space-y-3 pb-2">
        <div className="space-y-1.5">
          <Label htmlFor="rename-input">Naya naam</Label>
          <Input
            id="rename-input"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-11 rounded-lg text-base"
            maxLength={180}
            enterKeyHint="done"
            onFocus={(e) => {
              if (isFile) {
                const dot = e.target.value.lastIndexOf(".");
                e.target.setSelectionRange(0, dot > 0 ? dot : e.target.value.length);
              } else e.target.select();
            }}
          />
          {finalName && finalName !== name ? (
            <p className="text-[12.5px] text-muted-foreground">
              Banega: <span className="font-mono text-foreground">{finalName}</span>
            </p>
          ) : null}
          {extChanged ? (
            <p className="text-[12.5px] text-destructive">Extension badal rahi hai — file khulna band ho sakti hai.</p>
          ) : null}
        </div>
      </form>
    </ResponsiveDialog>
  );
}

/* -------------------------------- Move -------------------------------- */

export function MoveDialog({
  items,
  onOpenChange,
  busy,
  onSubmit,
}: {
  /** One item (menu action) or many (selection). Empty = closed. */
  items: LibraryItem[];
  onOpenChange: (o: boolean) => void;
  busy: boolean;
  onSubmit: (toFolder: string) => Promise<void>;
}) {
  const open = items.length > 0;
  const folders = useQuery({ ...foldersQuery, enabled: open });
  const [filter, setFilter] = useState("");
  const [target, setTarget] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setFilter("");
      setTarget(null);
    }
  }, [open]);

  const first = items[0];
  const current = first ? parentPath(first.path) : "";
  const options = useMemo(() => {
    const all = ["", ...(folders.data ?? [])];
    const blocked = items.filter((i) => i.type === "folder").map((i) => i.path);
    return all.filter((p) => {
      if (p === current) return false;
      if (blocked.some((b) => p === b || p.startsWith(b + "/"))) return false;
      if (!filter.trim()) return true;
      return p.toLowerCase().includes(filter.trim().toLowerCase());
    });
  }, [folders.data, items, current, filter]);

  const description = !first ? undefined : items.length === 1 ? first.name : `${items.length} items · ${first.name}${items.length > 1 ? " aur baaki" : ""}`;

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Kahan move karein?"
      description={description}
      locked={busy}
      footer={
        <>
          <Button type="button" variant="ghost" className="h-11 rounded-lg" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            className="pressable h-11 rounded-lg px-5"
            disabled={target === null || busy}
            onClick={() => {
              if (target === null) return;
              haptic("light");
              void onSubmit(target);
            }}
          >
            {busy ? "Move ho raha hai…" : "Yahan move karo"}
          </Button>
        </>
      }
    >
      <div className="space-y-3 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Folder dhoondho…"
            className="h-11 rounded-lg pl-9 text-base"
            aria-label="Filter folders"
          />
        </div>
        <ul className="max-h-72 overflow-y-auto rounded-2xl border border-border bg-card" role="listbox" aria-label="Destination folder">
          {folders.isPending ? (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">Folders load ho rahe hain…</li>
          ) : options.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">Koi doosra folder nahi mila.</li>
          ) : (
            options.map((p) => {
              const selected = target === p;
              const depth = p ? p.split("/").length : 0;
              return (
                <li key={p || "__root"}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      haptic("selection");
                      setTarget(p);
                    }}
                    className={cn(
                      "flex min-h-11 w-full items-center gap-3 border-b border-border px-3 text-left text-[14px] transition-colors last:border-b-0 active:bg-muted/60",
                      selected ? "bg-accent text-accent-foreground" : "[@media(hover:hover)]:hover:bg-muted/50",
                    )}
                    style={{ paddingLeft: `${12 + Math.min(depth, 6) * 14}px` }}
                  >
                    <Folder className="h-4 w-4 shrink-0 text-kind-folder-foreground" />
                    <span className="min-w-0 flex-1 truncate">{p ? p.split("/").pop() : "Library (root)"}</span>
                    {p && depth > 1 ? <span className="hidden truncate text-[12px] text-muted-foreground sm:block">{parentPath(p)}</span> : null}
                    {selected ? <Check className="h-4 w-4 shrink-0" /> : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </ResponsiveDialog>
  );
}

/* ------------------------------- Delete ------------------------------- */

export function DeleteDialog({
  items,
  onOpenChange,
  busy,
  onConfirm,
}: {
  /** One item (menu action) or many (selection). Empty = closed. */
  items: LibraryItem[];
  onOpenChange: (o: boolean) => void;
  busy: boolean;
  onConfirm: () => Promise<void>;
}) {
  const item = items[0];
  const many = items.length > 1;
  const isFolder = !many && item?.type === "folder";
  const count = item?.type === "folder" ? item.fileCount : 0;
  const folderCount = items.filter((i) => i.type === "folder").length;
  const filesInside = items.reduce((n, i) => n + (i.type === "folder" ? i.fileCount : 1), 0);
  const title = many ? `${items.length} items delete karein?` : isFolder ? "Ye folder delete karein?" : "Ye file delete karein?";
  const body = many
    ? `${folderCount ? `${folderCount} folder${folderCount === 1 ? "" : "s"} samet ` : ""}kul ${filesInside} file${filesInside === 1 ? "" : "s"} hat jayengi. Share kiye gaye links kaam karna band kar denge.`
    : isFolder
      ? `Andar ki ${count} file${count === 1 ? "" : "s"} bhi delete ho jayengi. Share kiye gaye links kaam karna band kar denge.`
      : "Share kiya gaya link kaam karna band kar dega. GitHub history mein file rahegi, par library se hat jayegi.";
  return (
    <AlertDialog open={items.length > 0} onOpenChange={(o) => (!busy || o ? onOpenChange(o) : undefined)}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-xl">{title}</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="block font-medium text-foreground">
              {many ? items.slice(0, 3).map((i) => i.name).join(", ") + (items.length > 3 ? ` +${items.length - 3}` : "") : item?.name}
            </span>
            <span className="mt-1 block">{body}</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11 rounded-lg" disabled={busy}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="pressable h-11 rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={busy}
            onClick={(e) => {
              e.preventDefault();
              haptic("medium");
              void onConfirm();
            }}
          >
            {busy ? "Delete ho raha hai…" : "Delete forever"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/* -------------------------------- Label ------------------------------- */

export function LabelDialog({
  item,
  onOpenChange,
  busy,
  onSubmit,
}: {
  item: LibraryItem | null;
  onOpenChange: (o: boolean) => void;
  busy: boolean;
  onSubmit: (label: { title: string; note: string }) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => {
    if (item) {
      setTitle(item.title ?? "");
      setNote(item.note ?? "");
    }
  }, [item]);
  const changed = !!item && (title.trim() !== (item.title ?? "") || note.trim() !== (item.note ?? ""));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!changed || busy) return;
    haptic("light");
    void onSubmit({ title: title.trim(), note: note.trim() });
  };

  return (
    <ResponsiveDialog
      open={!!item}
      onOpenChange={onOpenChange}
      title="Title aur note"
      description="File ka naam aur link waise hi rahenge — sirf dikhne wala title badlega."
      locked={busy}
      footer={
        <>
          <Button type="button" variant="ghost" className="h-11 rounded-lg" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="label-form" className="pressable h-11 rounded-lg px-5" disabled={!changed || busy}>
            {busy ? "Save ho raha hai…" : "Save karo"}
          </Button>
        </>
      }
    >
      <form id="label-form" onSubmit={submit} className="space-y-4 pb-2">
        <div className="space-y-1.5">
          <Label htmlFor="label-title">Dikhne wala title</Label>
          <Input
            id="label-title"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={item?.name}
            className="h-11 rounded-lg text-base"
            maxLength={120}
          />
          <p className="text-[12px] text-muted-foreground">Khaali chhodo to file ka naam dikhega.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="label-note">Chhota note</Label>
          <Textarea
            id="label-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="jaise: Board exam 2026 ke liye important"
            className="min-h-20 rounded-lg text-base"
            maxLength={400}
          />
        </div>
      </form>
    </ResponsiveDialog>
  );
}
