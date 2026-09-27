import { AlertCircle, Check, CloudUpload, FolderPlus, Link2, RotateCcw, X } from "lucide-react";
import { type ChangeEvent, type DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { useCopy } from "@/hooks/useCopy";
import { useLinkOrigin } from "@/hooks/useOrigin";
import type { UploadResponse, UploadedEntry } from "@/lib/library-types";
import { buildLink, type LinkStyle } from "@/lib/links";
import { haptic } from "@/lib/haptics";
import { cleanFileName, cleanFolderName, fileKind, formatBytes, joinPath } from "@/lib/paths";
import { MAX_FILES_PER_UPLOAD, MAX_FILE_BYTES, repoLabel, type RepoRef } from "@/lib/storage-config";
import { cn } from "@/lib/utils";

import { KindIcon } from "./KindIcon";
import { ResponsiveDialog } from "./ResponsiveDialog";

type Status = "queued" | "uploading" | "done" | "failed" | "too-big";

interface QueuedFile {
  id: string;
  file: File;
  status: Status;
  error?: string | undefined;
  result?: UploadedEntry | undefined;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder: string;
  repo: RepoRef;
  defaultStyle: LinkStyle;
  /** Immediate subfolders of `folder` — shown as quick picks. */
  subfolders?: string[];
  onUploaded: (commitSha: string) => void | Promise<void>;
}

/** Keep a single request well under Worker memory/body limits; large files go alone. */
const BATCH_BYTES = 16 * 1024 * 1024;
const BATCH_FILES = 4;

function makeBatches(files: QueuedFile[]): QueuedFile[][] {
  const batches: QueuedFile[][] = [];
  let cur: QueuedFile[] = [];
  let curBytes = 0;
  for (const f of files) {
    const size = f.file.size;
    if (cur.length && (curBytes + size > BATCH_BYTES || cur.length >= BATCH_FILES)) {
      batches.push(cur);
      cur = [];
      curBytes = 0;
    }
    cur.push(f);
    curBytes += size;
  }
  if (cur.length) batches.push(cur);
  return batches;
}

function postBatch(
  folder: string,
  clean: boolean,
  files: File[],
  onProgress: (ratio: number) => void,
): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.set("folder", folder);
    form.set("clean", clean ? "1" : "0");
    for (const f of files) form.append("files", f, f.name);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.responseType = "json";
    xhr.timeout = 10 * 60 * 1000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.min(1, e.loaded / e.total));
    };
    xhr.onerror = () => reject(new Error("Network toot gaya — internet check karke dobara try karo."));
    xhr.ontimeout = () => reject(new Error("Upload mein bahut der lagi — chhoti batch mein try karo."));
    xhr.onload = () => {
      const body = (xhr.response ?? null) as (UploadResponse & { error?: string }) | null;
      if (xhr.status >= 200 && xhr.status < 300 && body?.ok) return resolve(body);
      reject(new Error(body?.error || `Upload fail hua (HTTP ${xhr.status}).`));
    };
    xhr.send(form);
  });
}

function nextId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function UploadSheet({ open, onOpenChange, folder, repo, defaultStyle, subfolders = [], onUploaded }: Props) {
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [subfolder, setSubfolder] = useState("");
  const [picked, setPicked] = useState(""); // "" = yahin, "__new__" = naya folder
  const [clean, setClean] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { copy, copied } = useCopy("Sabhi links copy ho gaye");
  const origin = useLinkOrigin();

  const effectiveSub = picked === "__new__" ? subfolder : picked;
  const targetFolder = useMemo(
    () => joinPath(folder, cleanFolderName(effectiveSub, { slug: clean })),
    [folder, effectiveSub, clean],
  );

  useEffect(() => {
    if (!open) {
      setQueue([]);
      setSubfolder("");
      setPicked("");
      setBusy(false);
      setProgress(0);
    }
  }, [open]);

  const addFiles = useCallback((list: FileList | File[]) => {
    const files = Array.from(list);
    if (!files.length) return;
    setQueue((prev) => {
      const room = MAX_FILES_PER_UPLOAD * 3 - prev.length;
      const picked = files.slice(0, Math.max(0, room));
      if (picked.length < files.length) toast.error(`Ek baar mein zyada se zyada ${MAX_FILES_PER_UPLOAD * 3} files.`);
      const seen = new Set(prev.map((q) => `${q.file.name}:${q.file.size}`));
      const fresh = picked
        .filter((f) => !seen.has(`${f.name}:${f.size}`))
        .map<QueuedFile>((file) => ({
          id: nextId(),
          file,
          status: file.size > MAX_FILE_BYTES ? "too-big" : file.size === 0 ? "failed" : "queued",
          error: file.size > MAX_FILE_BYTES ? "48 MB se badi — CDN par nahi chalegi" : file.size === 0 ? "Khaali file" : undefined,
        }));
      return [...prev, ...fresh];
    });
  }, []);

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = "";
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (busy) return;
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
  };

  const pending = queue.filter((q) => q.status === "queued" || q.status === "failed");
  const uploadable = pending.filter((q) => q.file.size > 0 && q.file.size <= MAX_FILE_BYTES);
  const done = queue.filter((q) => q.status === "done");
  const totalBytes = uploadable.reduce((n, q) => n + q.file.size, 0);
  const allFinished = queue.length > 0 && queue.every((q) => q.status === "done" || q.status === "too-big");

  const setStatus = (ids: string[], patch: Partial<QueuedFile>) =>
    setQueue((prev) => prev.map((q) => (ids.includes(q.id) ? { ...q, ...patch } : q)));

  const start = async () => {
    if (!uploadable.length || busy) return;
    haptic("light");
    setBusy(true);
    const batches = makeBatches(uploadable);
    const doneBytesBefore: number[] = [];
    let acc = 0;
    for (const b of batches) {
      doneBytesBefore.push(acc);
      acc += b.reduce((n, q) => n + q.file.size, 0);
    }
    let lastSha = "";
    let failures = 0;
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]!;
      const ids = batch.map((q) => q.id);
      setStatus(ids, { status: "uploading", error: undefined });
      const batchBytes = batch.reduce((n, q) => n + q.file.size, 0);
      try {
        const res = await postBatch(
          targetFolder,
          clean,
          batch.map((q) => q.file),
          (ratio) => setProgress(totalBytes ? (doneBytesBefore[i]! + ratio * batchBytes) / totalBytes : ratio),
        );
        lastSha = res.commitSha;
        setQueue((prev) =>
          prev.map((q) => {
            if (!ids.includes(q.id)) return q;
            const expected = cleanFileName(q.file.name, { slug: clean });
            const hit = res.uploaded.find((u) => u.name === expected) ?? res.uploaded[batch.indexOf(q)];
            return { ...q, status: "done", result: hit };
          }),
        );
      } catch (err) {
        failures += batch.length;
        setStatus(ids, { status: "failed", error: err instanceof Error ? err.message : "Upload fail hua." });
      }
    }
    setBusy(false);
    setProgress(1);
    if (lastSha) await onUploaded(lastSha);
    if (failures === 0) {
      haptic("medium");
      toast.success(uploadable.length === 1 ? "Upload ho gaya" : `${uploadable.length} files upload ho gayi`);
    } else {
      toast.error(`${failures} file${failures === 1 ? "" : "s"} upload nahi hui — Retry dabao.`);
    }
  };

  const linkFor = (path: string) => buildLink(defaultStyle, path, { repo, origin });

  const copyAll = () => {
    const links = done.map((q) => q.result?.path).filter((p): p is string => !!p).map(linkFor);
    if (links.length) void copy(links.join("\n"));
  };

  const remove = (id: string) => setQueue((prev) => prev.filter((q) => q.id !== id));

  const footer = allFinished ? (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
      {done.length ? (
        <Button type="button" variant="outline" className="pressable h-11 rounded-lg" onClick={copyAll}>
          {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
          {done.length === 1 ? "Link copy karo" : `Sabhi ${done.length} links copy karo`}
        </Button>
      ) : null}
      <Button type="button" className="pressable h-11 rounded-lg" onClick={() => onOpenChange(false)}>
        Done
      </Button>
    </div>
  ) : (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
      <Button type="button" variant="ghost" className="h-11 rounded-lg" onClick={() => onOpenChange(false)} disabled={busy}>
        Cancel
      </Button>
      <Button type="button" className="pressable h-11 rounded-lg px-5" onClick={() => void start()} disabled={busy || !uploadable.length}>
        <CloudUpload className="h-4 w-4" />
        {busy
          ? `Upload ho raha hai… ${Math.round(progress * 100)}%`
          : uploadable.length
            ? `Upload karo · ${uploadable.length} file${uploadable.length === 1 ? "" : "s"} · ${formatBytes(totalBytes)}`
            : "Upload karo"}
      </Button>
    </div>
  );

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Files upload karo"
      description={`Repo: ${repoLabel(repo)}@${repo.branch}`}
      footer={footer}
      locked={busy}
      className="sm:max-w-xl"
    >
      <div className="space-y-4 pb-2">
        {/* Kahan ja raha hai — repo + folder ka poora path */}
        <div className="flex items-start gap-2.5 rounded-xl border border-border bg-muted/50 px-3 py-2.5">
          <FolderPlus className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 text-[12.5px] leading-snug">
            <span className="block text-muted-foreground">
              {repoLabel(repo)} <span className="opacity-70">@{repo.branch}</span>
            </span>
            <span className="block break-all font-medium text-foreground">
              {targetFolder ? `/${targetFolder}` : "/ (library root)"}
            </span>
          </div>
        </div>

        <input ref={inputRef} type="file" multiple className="sr-only" onChange={onPick} aria-label="Files chuno" />
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            if (!busy) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            "pressable flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors",
            dragOver ? "border-primary bg-accent" : "border-border bg-card hover:border-primary/50",
            busy && "opacity-60",
          )}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <CloudUpload className="h-6 w-6" />
          </span>
          <span className="text-[15px] font-medium text-foreground">Files chuno ya yahan chhodo</span>
          <span className="text-[12.5px] text-muted-foreground">
            PDF, images, docs · har file 48 MB tak · {MAX_FILES_PER_UPLOAD} files ek saath
          </span>
        </button>

        {!allFinished ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="upload-folder-pick" className="text-[13px]">
                Kis folder me daalna hai?
              </Label>
              <select
                id="upload-folder-pick"
                value={picked}
                onChange={(e) => setPicked(e.target.value)}
                disabled={busy}
                className="h-11 w-full rounded-lg border border-input bg-card px-3 text-base text-foreground"
              >
                <option value="">Yahin — {folder ? `/${folder}` : "Library (root)"}</option>
                {subfolders.map((name) => (
                  <option key={name} value={name}>
                    {name}/
                  </option>
                ))}
                <option value="__new__">+ Naya folder banao…</option>
              </select>
            </div>
            {picked === "__new__" ? (
              <div className="space-y-1.5">
                <Label htmlFor="upload-subfolder" className="text-[13px]">
                  Naye folder ka naam
                </Label>
                <div className="relative">
                  <FolderPlus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="upload-subfolder"
                    value={subfolder}
                    onChange={(e) => setSubfolder(e.target.value)}
                    placeholder="jaise: Chapter 3"
                    className="h-11 rounded-lg pl-9 text-base"
                    disabled={busy}
                    enterKeyHint="done"
                  />
                </div>
                <p className="text-[11.5px] text-muted-foreground">Folder upload ke saath hi ban jayega.</p>
              </div>
            ) : null}
            <label className="flex h-11 items-center justify-between gap-3 rounded-lg border border-input bg-card px-3 text-[13px]">
              <span className="text-foreground">
                Naam saaf karo
                <span className="block text-[11px] text-muted-foreground">spaces → hyphen, chhote link</span>
              </span>
              <Switch checked={clean} onCheckedChange={setClean} disabled={busy} aria-label="Clean file names" />
            </label>
          </div>
        ) : null}

        {busy ? <Progress value={Math.round(progress * 100)} className="h-2" /> : null}

        {queue.length ? (
          <ul className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            {queue.map((q) => {
              const shown = q.result?.name ?? cleanFileName(q.file.name, { slug: clean });
              const kind = fileKind(shown);
              return (
                <li key={q.id} className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0">
                  <KindIcon kind={kind} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-foreground">{shown}</span>
                    <span className="block truncate text-[12px] text-muted-foreground tabular-nums">
                      {formatBytes(q.file.size)}
                      {shown !== q.file.name && q.status !== "done" ? <> · pehle: {q.file.name}</> : null}
                      {q.result?.replaced ? " · purani file replace hui" : null}
                      {q.error ? <span className="text-destructive"> · {q.error}</span> : null}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center">
                    {q.status === "done" && q.result ? (
                      <DoneCopy url={linkFor(q.result.path)} />
                    ) : q.status === "uploading" ? (
                      <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" aria-label="Uploading" />
                    ) : q.status === "failed" ? (
                      <AlertCircle className="mr-2 h-4 w-4 text-destructive" aria-label="Failed" />
                    ) : q.status === "too-big" ? (
                      <AlertCircle className="mr-2 h-4 w-4 text-destructive" aria-label="Too big" />
                    ) : null}
                    {!busy && q.status !== "done" ? (
                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label="Hatao" onClick={() => remove(q.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}

        {!busy && queue.some((q) => q.status === "failed" && q.file.size > 0 && q.file.size <= MAX_FILE_BYTES) && done.length ? (
          <Button type="button" variant="outline" className="h-10 rounded-lg" onClick={() => void start()}>
            <RotateCcw className="h-4 w-4" />
            Failed files dobara bhejo
          </Button>
        ) : null}
      </div>
    </ResponsiveDialog>
  );
}

function DoneCopy({ url }: { url: string }) {
  const { copy, copied } = useCopy();
  return (
    <Button
      type="button"
      variant={copied ? "secondary" : "ghost"}
      size="sm"
      className="pressable h-9 rounded-lg px-2.5 text-[12.5px]"
      onClick={() => void copy(url)}
    >
      {copied ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
      {copied ? "Ho gaya" : "Copy"}
    </Button>
  );
}
