import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowUpDown, CheckSquare, ChevronRight, CloudUpload, EyeOff, FolderPlus, LayoutGrid, List, Sparkle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { useCopy } from "@/hooks/useCopy";
import { useLibraryActions } from "@/hooks/useLibraryActions";
import { useLinkOrigin } from "@/hooks/useOrigin";
import { useOwner } from "@/hooks/useOwner";
import type { LibraryFile, LibraryItem } from "@/lib/library-types";
import { buildLink } from "@/lib/links";
import { haptic } from "@/lib/haptics";
import { formatBytes } from "@/lib/paths";
import { folderQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

import { AppShell, PageTitle } from "./AppShell";
import { ArrangeList } from "./ArrangeList";
import { DeleteDialog, LabelDialog, MoveDialog, NewFolderDialog, RenameDialog } from "./ItemDialogs";
import { ItemCard } from "./ItemCard";
import type { ItemAction } from "./ItemMenu";
import { ItemRow } from "./ItemRow";
import { LinkSheet } from "./LinkSheet";
import { SelectionBar } from "./SelectionBar";
import { EmptyState } from "./states";
import { UploadSheet } from "./UploadSheet";

type ViewMode = "list" | "grid";
const VIEW_KEY = "nb:view";

export function FolderPage({ path }: { path: string }) {
  const { data: view } = useSuspenseQuery(folderQuery(path));
  const { isOwner, session } = useOwner();
  const actions = useLibraryActions();
  const { copy } = useCopy();
  const origin = useLinkOrigin();
  const navigate = useNavigate();

  const [mode, setMode] = useState<ViewMode>("list");
  const [arranging, setArranging] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [uploadOpen, setUploadOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<LibraryItem | null>(null);
  const [moveTargets, setMoveTargets] = useState<LibraryItem[]>([]);
  const [deleteTargets, setDeleteTargets] = useState<LibraryItem[]>([]);
  const [labelTarget, setLabelTarget] = useState<LibraryItem | null>(null);
  const [linksTarget, setLinksTarget] = useState<LibraryItem | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(VIEW_KEY);
      if (saved === "grid" || saved === "list") setMode(saved);
    } catch {
      // storage unavailable — keep default
    }
  }, []);

  useEffect(() => {
    setArranging(false);
    setSelecting(false);
    setSelected(new Set());
  }, [path]);

  const changeMode = (next: ViewMode) => {
    haptic("selection");
    setMode(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      // ignore
    }
  };

  const defaultStyle = view.settings.linkStyle ?? session?.defaultLinkStyle ?? "pages";
  const repo = view.repo;
  const commit = view.headSha;

  /* ------------------------------ selection ------------------------------ */

  const selectedItems = useMemo(() => view.items.filter((i) => selected.has(i.path)), [view.items, selected]);
  const selectedFiles = selectedItems.filter((i): i is LibraryFile => i.type === "file");

  const startSelecting = () => {
    haptic("selection");
    setSelecting(true);
    setSelected(new Set());
  };
  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
  };
  const toggle = (item: LibraryItem) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(item.path)) next.delete(item.path);
      else next.add(item.path);
      return next;
    });
  };

  const copySelectedLinks = async () => {
    if (selectedFiles.length === 0) return;
    const ctx = { repo, commit, origin: origin || (typeof window !== "undefined" ? window.location.origin : "") };
    const text = selectedFiles.map((f) => buildLink(defaultStyle, f.path, ctx)).join("\n");
    const ok = await copy(text, selectedFiles.length === 1 ? "Link copy ho gaya" : `${selectedFiles.length} links copy ho gaye — har link nayi line par`);
    if (ok) stopSelecting();
  };

  /* -------------------------------- actions -------------------------------- */

  const onAction = (action: ItemAction, item: LibraryItem) => {
    switch (action) {
      case "rename":
        return setRenameTarget(item);
      case "move":
        return setMoveTargets([item]);
      case "delete":
        return setDeleteTargets([item]);
      case "label":
        return setLabelTarget(item);
      case "links":
        return setLinksTarget(item);
      case "hide":
        return void actions.setHidden(item.path, !item.hidden);
    }
  };

  const meta = (
    <>
      {view.totals.folders ? `${view.totals.folders} folder${view.totals.folders === 1 ? "" : "s"} · ` : null}
      {view.totals.files} file{view.totals.files === 1 ? "" : "s"}
      {view.totals.bytes ? ` · ${formatBytes(view.totals.bytes)}` : null}
      {view.customOrder ? (
        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
          <Sparkle className="h-3 w-3" />
          Custom order
        </span>
      ) : null}
      {view.hidden ? (
        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          <EyeOff className="h-3 w-3" />
          Hidden folder
        </span>
      ) : null}
    </>
  );

  const ownerTools = isOwner && !arranging && !selecting;
  const canSelect = view.items.length > 0 && !arranging;

  const bottomBar = ownerTools ? (
    <>
      <Button className="pressable h-12 flex-1 rounded-xl text-[15px]" onClick={() => setUploadOpen(true)}>
        <CloudUpload className="h-5 w-5" />
        Upload
      </Button>
      <Button variant="outline" className="pressable h-12 rounded-xl px-4" onClick={() => setNewFolderOpen(true)} aria-label="Naya folder">
        <FolderPlus className="h-5 w-5" />
      </Button>
      <Button
        variant="outline"
        className="pressable h-12 rounded-xl px-4"
        onClick={() => {
          haptic("selection");
          setArranging(true);
        }}
        disabled={view.items.length < 2}
        aria-label="Arrange"
      >
        <ArrowUpDown className="h-5 w-5" />
      </Button>
    </>
  ) : null;

  const selectionBar = selecting ? (
    <SelectionBar
      count={selectedItems.length}
      total={view.items.length}
      fileCount={selectedFiles.length}
      isOwner={isOwner}
      busy={actions.busy}
      onSelectAll={() => {
        haptic("selection");
        setSelected(new Set(view.items.map((i) => i.path)));
      }}
      onClear={() => {
        haptic("selection");
        setSelected(new Set());
      }}
      onCopyLinks={() => void copySelectedLinks()}
      onMove={() => setMoveTargets(selectedItems)}
      onDelete={() => setDeleteTargets(selectedItems)}
      onExit={stopSelecting}
    />
  ) : null;

  return (
    <AppShell bottomBar={bottomBar} footer={selectionBar}>
      <nav aria-label="Breadcrumb" className="-mx-4 mb-3 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0">
        <ol className="flex items-center gap-1 whitespace-nowrap text-[13px] text-muted-foreground">
          {view.crumbs.map((c, i) => {
            const last = i === view.crumbs.length - 1;
            return (
              <li key={c.path || "root"} className="flex items-center gap-1">
                {i > 0 ? <ChevronRight className="h-3.5 w-3.5 opacity-60" /> : null}
                {last ? (
                  <span className="rounded-md px-1.5 py-1 font-medium text-foreground" aria-current="page">
                    {c.name}
                  </span>
                ) : c.path ? (
                  <Link to="/f/$" params={{ _splat: c.path }} className="rounded-md px-1.5 py-1 hover:bg-muted hover:text-foreground">
                    {c.name}
                  </Link>
                ) : (
                  <Link to="/files" className="rounded-md px-1.5 py-1 hover:bg-muted hover:text-foreground">
                    {c.name}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <PageTitle
        title={view.title}
        note={view.note}
        meta={meta}
        actions={
          !arranging ? (
            <>
              {ownerTools ? (
                <div className="hidden items-center gap-2 sm:flex">
                  <Button className="pressable h-10 rounded-lg" onClick={() => setUploadOpen(true)}>
                    <CloudUpload className="h-4 w-4" />
                    Upload
                  </Button>
                  <Button variant="outline" className="pressable h-10 rounded-lg" onClick={() => setNewFolderOpen(true)}>
                    <FolderPlus className="h-4 w-4" />
                    Naya folder
                  </Button>
                  <Button
                    variant="outline"
                    className="pressable h-10 rounded-lg"
                    disabled={view.items.length < 2}
                    onClick={() => {
                      haptic("selection");
                      setArranging(true);
                    }}
                  >
                    <ArrowUpDown className="h-4 w-4" />
                    Arrange
                  </Button>
                </div>
              ) : null}
              {canSelect ? (
                <Button
                  variant={selecting ? "default" : "outline"}
                  className="pressable h-10 rounded-lg px-3"
                  aria-pressed={selecting}
                  aria-label={selecting ? "Selection band karo" : "Select karo"}
                  onClick={selecting ? stopSelecting : startSelecting}
                >
                  <CheckSquare className="h-4 w-4" />
                  <span className="hidden sm:inline">{selecting ? "Done" : "Select"}</span>
                </Button>
              ) : null}
              {!selecting ? (
                <div className="flex items-center rounded-lg border border-input bg-card p-0.5" role="group" aria-label="View">
                  <button
                    type="button"
                    aria-pressed={mode === "list"}
                    aria-label="List view"
                    onClick={() => changeMode("list")}
                    className={cn("flex h-9 w-10 items-center justify-center rounded-md transition-colors", mode === "list" ? "bg-foreground text-background" : "text-muted-foreground")}
                  >
                    <List className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-pressed={mode === "grid"}
                    aria-label="Grid view"
                    onClick={() => changeMode("grid")}
                    className={cn("flex h-9 w-10 items-center justify-center rounded-md transition-colors", mode === "grid" ? "bg-foreground text-background" : "text-muted-foreground")}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
            </>
          ) : null
        }
      />

      {selecting ? (
        <p className="mt-3 rounded-xl bg-accent/60 px-3 py-2 text-[13px] text-accent-foreground">
          Items par tap karke chuno — neeche se sabke link ek saath copy{isOwner ? ", move ya delete" : ""} karo.
        </p>
      ) : null}

      <div className="mt-5">
        {arranging ? (
          <ArrangeList
            key={view.headSha}
            items={view.items}
            saving={actions.busy}
            onCancel={() => setArranging(false)}
            onSave={async (names) => {
              const ok = await actions.saveOrder(path, names);
              if (ok) setArranging(false);
            }}
          />
        ) : view.items.length === 0 ? (
          <EmptyState
            title={path ? "Ye folder abhi khaali hai." : "Library abhi khaali hai."}
            hint={isOwner ? "Upload dabao aur PDFs ya images chuno — link turant mil jayega." : "Owner jab files daalega, yahan dikhengi."}
            action={
              isOwner ? (
                <Button className="pressable h-11 rounded-lg px-5" onClick={() => setUploadOpen(true)}>
                  <CloudUpload className="h-4 w-4" />
                  Upload karo
                </Button>
              ) : undefined
            }
          />
        ) : mode === "grid" ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {view.items.map((item) => (
              <ItemCard
                key={item.path}
                item={item}
                repo={repo}
                commit={commit}
                defaultStyle={defaultStyle}
                isOwner={isOwner}
                onAction={onAction}
                selecting={selecting}
                selected={selected.has(item.path)}
                onToggle={toggle}
              />
            ))}
          </ul>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            {view.items.map((item) => (
              <ItemRow
                key={item.path}
                item={item}
                repo={repo}
                commit={commit}
                defaultStyle={defaultStyle}
                isOwner={isOwner}
                onAction={onAction}
                selecting={selecting}
                selected={selected.has(item.path)}
                onToggle={toggle}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Owner dialogs */}
      <UploadSheet
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        folder={path}
        repo={repo}
        defaultStyle={defaultStyle}
        onUploaded={async () => {
          await actions.refreshAfterUpload();
        }}
      />
      <NewFolderDialog
        open={newFolderOpen}
        onOpenChange={setNewFolderOpen}
        parent={path}
        busy={actions.busy}
        onSubmit={async (name) => {
          const made = await actions.createFolder(path, name);
          if (!made) return;
          setNewFolderOpen(false);
          // Open the folder right away, like a phone's file manager does.
          void navigate({ to: "/f/$", params: { _splat: made.path } });
        }}
      />
      <RenameDialog
        item={renameTarget}
        onOpenChange={(o) => !o && setRenameTarget(null)}
        busy={actions.busy}
        onSubmit={async (newName) => {
          if (!renameTarget) return;
          const ok = await actions.rename(renameTarget.path, newName);
          if (ok) setRenameTarget(null);
        }}
      />
      <MoveDialog
        items={moveTargets}
        onOpenChange={(o) => !o && setMoveTargets([])}
        busy={actions.busy}
        onSubmit={async (toFolder) => {
          if (moveTargets.length === 0) return;
          const ok =
            moveTargets.length === 1
              ? await actions.move(moveTargets[0]!.path, toFolder)
              : await actions.moveMany(
                  moveTargets.map((i) => i.path),
                  toFolder,
                );
          if (ok) {
            setMoveTargets([]);
            stopSelecting();
          }
        }}
      />
      <DeleteDialog
        items={deleteTargets}
        onOpenChange={(o) => !o && setDeleteTargets([])}
        busy={actions.busy}
        onConfirm={async () => {
          if (deleteTargets.length === 0) return;
          const ok =
            deleteTargets.length === 1
              ? await actions.remove(deleteTargets[0]!.path)
              : await actions.removeMany(deleteTargets.map((i) => i.path));
          if (ok) {
            setDeleteTargets([]);
            stopSelecting();
          }
        }}
      />
      <LabelDialog
        item={labelTarget}
        onOpenChange={(o) => !o && setLabelTarget(null)}
        busy={actions.busy}
        onSubmit={async (label) => {
          if (!labelTarget) return;
          const ok = await actions.saveLabel(labelTarget.path, label);
          if (ok) setLabelTarget(null);
        }}
      />
      {linksTarget && linksTarget.type === "file" ? (
        <LinkSheet
          open
          onOpenChange={(o) => !o && setLinksTarget(null)}
          path={linksTarget.path}
          name={linksTarget.name}
          repo={repo}
          commit={commit}
          defaultStyle={defaultStyle}
        />
      ) : null}
    </AppShell>
  );
}
