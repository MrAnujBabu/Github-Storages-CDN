import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Check, ChevronDown, ExternalLink, FolderOpen, Github, Lock, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, PageTitle } from "@/components/library/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useOwner } from "@/hooks/useOwner";
import type { StorageRepoSummary } from "@/lib/library-types";
import { addRepo, createRepo, listRepos, setActiveRepo } from "@/lib/library.functions";
import { formatBytes } from "@/lib/paths";
import { APP_NAME } from "@/lib/storage-config";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/repos")({
  head: () => ({
    meta: [
      { title: `Storage repos — ${APP_NAME}` },
      { name: "description", content: "Saare storage repos: size, folders, files aur naya repo banao." },
      { property: "og:title", content: `Storage repos — ${APP_NAME}` },
      { property: "og:description", content: "GitHub storage repos manage karo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReposPage,
});

const GB = 1024 * 1024 * 1024;
const WARN = 700 * 1024 * 1024;
const FULL = 900 * 1024 * 1024;

export const reposQueryKey = ["storage-repos"];

function ReposPage() {
  const { isOwner, loading } = useOwner();
  const list = useServerFn(listRepos);
  const q = useQuery({ queryKey: reposQueryKey, queryFn: () => list(), enabled: isOwner, staleTime: 30_000 });

  if (loading) return <AppShell compact><Skeleton className="h-40 w-full rounded-2xl" /></AppShell>;
  if (!isOwner) {
    return (
      <AppShell compact>
        <div className="mx-auto mt-10 max-w-sm rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-base font-medium">Repos sirf owner dekh sakta hai.</p>
          <Button asChild className="mt-5 h-11 rounded-lg px-5"><Link to="/sign-in">Owner sign in</Link></Button>
        </div>
      </AppShell>
    );
  }

  const repos = q.data ?? [];
  const active = repos.find((r) => r.active);
  const activeFull = active && active.sizeBytes >= FULL;

  return (
    <AppShell compact>
      <PageTitle title="Storage repos" note="Files kis GitHub repo mein ja rahi hain, kitni jagah bachi hai, aur naya repo." />

      <div className="mt-4 rounded-2xl border border-border bg-card p-4 text-[13px] leading-relaxed text-muted-foreground">
        <p className="font-medium text-foreground">Repo 1 GB ho jaaye to kya hoga?</p>
        <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
          <li>GitHub kehta hai repo 1 GB se chhota rakho, 5 GB se upar bilkul nahi. Files delete nahi hoti, par repo slow ho jaata hai aur GitHub email/limit kar sakta hai.</li>
          <li>Ek file max 100 MB (GitHub). CDN (jsDelivr) 20 MB se badi file serve nahi karta — badi PDF ke liye GitHub Pages link use hota hai.</li>
          <li>Ilaaj: 900 MB ke paas naya repo banao aur use <b>Active</b> karo. Purane links chalte rahenge.</li>
        </ul>
      </div>

      {activeFull ? (
        <div className="mt-4 flex items-start gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-[13px]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <span>Active repo <b>{active!.repo}</b> {formatBytes(active!.sizeBytes)} ka ho gaya — neeche naya repo banao aur Active karo.</span>
        </div>
      ) : null}

      <div className="mt-6 flex items-center justify-between px-1">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Aapke repos ({repos.length})</h2>
        <Button variant="ghost" size="sm" onClick={() => void q.refetch()} disabled={q.isFetching}>
          <RefreshCw className={cn("h-4 w-4", q.isFetching && "animate-spin")} /> Refresh
        </Button>
      </div>

      <div className="mt-2 space-y-3">
        {q.isLoading ? <Skeleton className="h-32 w-full rounded-2xl" /> : null}
        {q.error ? <p className="text-sm text-destructive">{(q.error as Error).message}</p> : null}
        {repos.map((r) => <RepoCard key={r.spec} r={r} />)}
      </div>

      <CreateRepoForm suggested={active ? nextName(active.repo, repos) : "edu-pdfs-2"} />
      <AddExistingForm />
    </AppShell>
  );
}

function nextName(base: string, repos: StorageRepoSummary[]): string {
  const stem = base.replace(/-\d+$/, "");
  const taken = new Set(repos.map((r) => r.repo));
  for (let i = 2; i < 100; i++) if (!taken.has(`${stem}-${i}`)) return `${stem}-${i}`;
  return `${stem}-new`;
}

function RepoCard({ r }: { r: StorageRepoSummary }) {
  const qc = useQueryClient();
  const activate = useServerFn(setActiveRepo);
  const [open, setOpen] = useState(r.active);
  const [busy, setBusy] = useState(false);
  const pct = Math.min(100, (r.sizeBytes / GB) * 100);
  const tone = r.sizeBytes >= GB ? "bg-destructive" : r.sizeBytes >= WARN ? "bg-yellow-500" : "bg-primary";

  const makeActive = async () => {
    setBusy(true);
    try {
      await activate({ data: { spec: r.spec } });
      toast.success(`${r.repo} ab Active hai — nayi uploads yahin jaayengi.`);
      await qc.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("rounded-2xl border bg-card p-4", r.active ? "border-primary" : "border-border")}>
      <div className="flex items-start gap-3">
        <Github className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-[15px] font-semibold text-foreground">{r.owner}/{r.repo}</p>
            {r.active ? <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">Active</span> : null}
            {r.private ? <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px]"><Lock className="h-3 w-3" /> Private</span> : null}
          </div>
          {r.ok ? (
            <>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {formatBytes(r.sizeBytes)} / 1 GB · {r.folderCount} folders · {r.fileCount} files
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" aria-label={`${pct.toFixed(0)}% bhara`}>
                <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.max(pct, 1)}%` }} />
              </div>
              <p className="mt-1 text-[11.5px] text-muted-foreground">{pct.toFixed(1)}% bhara</p>
            </>
          ) : (
            <p className="mt-1 text-[13px] text-destructive">{r.error ?? "Repo padh nahi paaye."}</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {!r.active ? (
          <Button size="sm" onClick={makeActive} disabled={busy || !r.ok}>
            <Check className="h-4 w-4" /> Active banao
          </Button>
        ) : null}
        {r.ok && r.folders.length ? (
          <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)}>
            <FolderOpen className="h-4 w-4" /> Folders <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" asChild>
          <a href={r.htmlUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /> GitHub</a>
        </Button>
      </div>

      {open && r.folders.length ? (
        <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border">
          {r.folders.map((f) => (
            <li key={f.name || "__root"} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
              <span className="truncate font-medium text-foreground">{f.name ? `/${f.name}` : "/ (root files)"}</span>
              <span className="shrink-0 text-muted-foreground">{f.files} files · {formatBytes(f.bytes)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function CreateRepoForm({ suggested }: { suggested: string }) {
  const qc = useQueryClient();
  const create = useServerFn(createRepo);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setPrivate] = useState(false);
  const [makeActive, setMakeActive] = useState(true);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = (name || suggested).trim();
    setBusy(true);
    try {
      const res = await create({ data: { name: n, description, isPrivate, makeActive } });
      toast.success(`Repo ${res.spec} ban gaya${makeActive ? " aur Active hai" : ""}.`);
      setName("");
      setDescription("");
      await qc.invalidateQueries();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-8 rounded-2xl border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold text-foreground"><Plus className="h-4 w-4" /> Naya repo banao</h2>
      <p className="mt-1 text-[12.5px] text-muted-foreground">Seedha aapke GitHub account mein banega — GitHub kholne ki zaroorat nahi.</p>
      <label className="mt-4 block text-[13px] font-medium">Repo ka naam</label>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={suggested} className="mt-1 h-11" maxLength={100} aria-label="Repo ka naam" />
      <label className="mt-3 block text-[13px] font-medium">Description (optional)</label>
      <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Class 12 notes part 2" className="mt-1 h-11" maxLength={300} />
      <div className="mt-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium">Private repo</p>
          <p className="text-[12px] text-muted-foreground">Private repo par CDN aur Pages links public nahi chalenge — study files ke liye Public rakho.</p>
        </div>
        <Switch checked={isPrivate} onCheckedChange={setPrivate} aria-label="Private repo" />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium">Banate hi Active karo (nayi uploads yahin)</p>
        <Switch checked={makeActive} onCheckedChange={setMakeActive} aria-label="Active karo" />
      </div>
      <Button type="submit" className="mt-4 h-11 w-full" disabled={busy}>
        {busy ? "Repo ban raha hai…" : `"${(name || suggested).trim()}" banao`}
      </Button>
    </form>
  );
}

function AddExistingForm() {
  const qc = useQueryClient();
  const add = useServerFn(addRepo);
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mt-4 mb-10 rounded-2xl border border-border bg-card p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await add({ data: { fullName: fullName.trim(), branch: "main" } });
          toast.success("Repo list mein jud gaya.");
          setFullName("");
          await qc.invalidateQueries({ queryKey: reposQueryKey });
        } catch (err) {
          toast.error((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="text-[13px] font-medium">Pehle se bana repo jodo</p>
      <div className="mt-2 flex gap-2">
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="MrAnujBabu/old-notes" className="h-11" />
        <Button type="submit" variant="outline" className="h-11" disabled={busy || !fullName.includes("/")}>Jodo</Button>
      </div>
    </form>
  );
}
