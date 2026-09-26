import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDownAZ, ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { LibraryFile, LibraryFolder, LibraryItem } from "@/lib/library-types";
import { haptic } from "@/lib/haptics";
import { naturalCompare } from "@/lib/paths";
import { cn } from "@/lib/utils";

import { KindIcon } from "./KindIcon";

interface Props {
  items: LibraryItem[];
  saving: boolean;
  onSave: (names: string[]) => Promise<void> | void;
  onCancel: () => void;
}

function SortableRow({
  item,
  index,
  count,
  onMove,
}: {
  item: LibraryItem;
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.path });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 border-b border-border bg-card px-2 py-2 last:border-b-0",
        isDragging && "relative z-10 rounded-xl shadow-float ring-1 ring-ring/30",
      )}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={`${item.name} ko drag karo`}
        className="touch-none flex h-11 w-9 cursor-grab items-center justify-center rounded-lg text-muted-foreground active:cursor-grabbing active:bg-muted"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <KindIcon kind={item.type === "file" ? item.kind : "folder"} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium text-foreground">{item.title ?? item.name}</span>
        <span className="block text-[12px] text-muted-foreground tabular-nums">#{index + 1}</span>
      </span>
      <div className="flex shrink-0 items-center">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Upar le jao"
          className="h-10 w-10 rounded-full"
          disabled={index === 0}
          onClick={() => {
            haptic("selection");
            onMove(index, index - 1);
          }}
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Neeche le jao"
          className="h-10 w-10 rounded-full"
          disabled={index === count - 1}
          onClick={() => {
            haptic("selection");
            onMove(index, index + 1);
          }}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}

function Group<T extends LibraryItem>({
  title,
  items,
  onChange,
}: {
  title: string;
  items: T[];
  onChange: (next: T[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = useMemo(() => items.map((i) => i.path), [items]);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    onChange(arrayMove(items, from, to));
  };

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    haptic("light");
    onChange(arrayMove(items, from, to));
  };

  if (!items.length) return null;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</h3>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[12px] font-medium text-primary hover:bg-accent"
          onClick={() => {
            haptic("selection");
            onChange([...items].sort((a, b) => naturalCompare(a.title ?? a.name, b.title ?? b.name)));
          }}
        >
          <ArrowDownAZ className="h-3.5 w-3.5" />
          A–Z
        </button>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragStart={() => haptic("selection")}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            {items.map((item, i) => (
              <SortableRow key={item.path} item={item} index={i} count={items.length} onMove={move} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </section>
  );
}

/** Owner "Arrange" mode: drag rows or use the arrows, then save once. Folders always sit above files. */
export function ArrangeList({ items, saving, onSave, onCancel }: Props) {
  const [folders, setFolders] = useState<LibraryFolder[]>(() => items.filter((i): i is LibraryFolder => i.type === "folder"));
  const [files, setFiles] = useState<LibraryFile[]>(() => items.filter((i): i is LibraryFile => i.type === "file"));

  const dirty = useMemo(() => {
    const next = [...folders, ...files].map((i) => i.path).join("\n");
    const orig = [...items.filter((i) => i.type === "folder"), ...items.filter((i) => i.type === "file")].map((i) => i.path).join("\n");
    return next !== orig;
  }, [folders, files, items]);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-accent/40 px-4 py-3 text-[13px] text-foreground/85">
        Rows ko pakad kar upar-neeche khisakao, ya arrows dabao. Sequence sabko isi order mein dikhega. Save dabane par hi change hota hai.
      </div>
      <Group title="Folders" items={folders} onChange={setFolders} />
      <Group title="Files" items={files} onChange={setFiles} />
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" className="h-11 rounded-lg px-4" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          type="button"
          className="pressable h-11 rounded-lg px-5"
          disabled={!dirty || saving}
          onClick={() => {
            haptic("light");
            void onSave([...folders, ...files].map((i) => i.name));
          }}
        >
          {saving ? "Save ho raha hai…" : "Order save karo"}
        </Button>
      </div>
    </div>
  );
}
