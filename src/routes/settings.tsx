import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Check, ExternalLink, Eye, EyeOff, Github, Globe, KeyRound, Link2, LogOut, RefreshCw, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell, PageTitle } from "@/components/library/AppShell";
import { DeliveryHealthCard } from "@/components/library/DeliveryHealthCard";
import { KindIcon } from "@/components/library/KindIcon";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useLibraryActions } from "@/hooks/useLibraryActions";
import { useOrigin } from "@/hooks/useOrigin";
import { useOwner } from "@/hooks/useOwner";
import {
  clearGithubToken,
  getGithubTokenStatus,
  saveGithubToken,
} from "@/lib/library.functions";
import { LINK_STYLES, buildLink, isPreviewOrigin, normalizeAppUrl, pagesBaseUrl, type LinkStyle } from "@/lib/links";
import { haptic } from "@/lib/haptics";
import { type FileKind, formatBytes, kindLabel } from "@/lib/paths";
import { pagesQuery, statsQuery } from "@/lib/queries";
import { APP_NAME, CDN_PACKAGE_LIMIT_BYTES, CDN_PACKAGE_WARN_BYTES, PAGES_SITE_LIMIT_BYTES, repoLabel } from "@/lib/storage-config";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: `Settings — ${APP_NAME}` },
      { name: "description", content: "Default link style, storage repo, CDN cache aur sign out." },
      { property: "og:title", content: `Settings — ${APP_NAME}` },
      { property: "og:description", content: "Owner settings." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

const SAMPLE_PATH = "Physics-12th/Chapter-1.pdf";

function SettingsPage() {
  const { isOwner, session, loading } = useOwner();
  const actions = useLibraryActions();
  const navigate = useNavigate();
  const stats = useQuery({ ...statsQuery, enabled: isOwner });
  const pages = useQuery({
    ...pagesQuery,
    enabled: isOwner,
    // While Pages is building, poll so the "live" state appears without a manual refresh.
    refetchInterval: (q) => (q.state.data?.enabled && q.state.data.status !== "built" ? 8000 : false),
  });
  const [purgeOpen, setPurgeOpen] = useState(false);

  if (loading) {
    return (
      <AppShell compact>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-6 h-40 w-full rounded-2xl" />
      </AppShell>
    );
  }

  if (!isOwner || !session) {
    return (
      <AppShell compact>
        <div className="mx-auto mt-10 max-w-sm rounded-2xl border border-border bg-card p-6 text-center shadow-card">
          <p className="text-base font-medium text-foreground">Settings sirf owner ke liye hain.</p>
          <p className="mt-1 text-sm text-muted-foreground">Sign in karke wapas aao.</p>
          <Button asChild className="pressable mt-5 h-11 rounded-lg px-5">
            <Link to="/sign-in">Owner sign in</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const repo = session.repo;
  const current = session.defaultLinkStyle;
  const ghUrl = `https://github.com/${repo.owner}/${repo.repo}/tree/${repo.branch}`;

  return (
    <AppShell compact>
      <PageTitle title="Settings" note="Link ka default style, storage aur CDN cache." />

      <section className="mt-6">
        <h2 className="px-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Copy link kya de?</h2>
        <p className="mt-1 px-1 text-[13px] text-muted-foreground">Har row ke link button aur "Copy link" par yahi format milega.</p>
        <ul className="mt-3 overflow-hidden rounded-2xl border border-border bg-card shadow-card" role="radiogroup" aria-label="Default link style">
          {LINK_STYLES.filter((s) => s.defaultable).map((s) => {
            const selected = s.id === current;
            return (
              <li key={s.id} className="border-b border-border last:border-b-0">
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={actions.busy}
                  onClick={() => {
                    if (selected) return;
                    haptic("selection");
                    void actions.setLinkStyle(s.id as LinkStyle);
                  }}
                  className={cn("flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors active:bg-muted/60", selected ? "bg-accent/50" : "[@media(hover:hover)]:hover:bg-muted/50")}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                      selected ? "border-primary bg-primary text-primary-foreground" : "border-input",
                    )}
                    aria-hidden
                  >
                    {selected ? <Check className="h-3 w-3" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-medium text-foreground">{s.label}</span>
                    <span className="block text-[12.5px] text-muted-foreground">{s.hint}</span>
                    <code className="mt-1.5 block truncate rounded-md bg-muted px-2 py-1 font-mono text-[11.5px] text-foreground/75">
                      {buildLink(s.id, SAMPLE_PATH, { repo, commit: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0", origin: "https://aapki-site.app" })}
                    </code>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <AppAddressSection saved={session.appUrl} busy={actions.busy} onSave={(url) => actions.setAppUrl(url)} />

      <GithubTokenSection />

      <section className="mt-8">
        <h2 className="px-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Storage</h2>
        <div className="mt-3 rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
              <Github className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium text-foreground">{repoLabel(repo)}</p>
              <Link to="/repos" className="text-[12.5px] font-medium text-primary">Saare repos / naya repo banao →</Link>
              <p className="text-[12.5px] text-muted-foreground">
                Public GitHub repo · jsDelivr CDN se deliver
                {!session.githubConfigured ? " · GitHub access abhi configure nahi hai (sirf padh sakte hain)" : ""}
              </p>
            </div>
            <Button asChild variant="ghost" size="icon" className="h-10 w-10 rounded-full" aria-label="GitHub par kholo">
              <a href={ghUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>

          {stats.isPending ? (
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
          ) : stats.data ? (
            <>
              <dl className="mt-4 grid grid-cols-3 gap-2">
                <Stat label="Files" value={String(stats.data.files)} />
                <Stat label="Folders" value={String(stats.data.folders)} />
                <Stat label="Size" value={formatBytes(stats.data.bytes)} />
              </dl>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {Object.entries(stats.data.byKind)
                  .sort((a, b) => b[1] - a[1])
                  .map(([kind, n]) => (
                    <span key={kind} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-[12px] text-foreground">
                      <KindIcon kind={kind as FileKind} size="sm" className="h-5 w-5 rounded" />
                      {kindLabel(kind as FileKind)} · {n}
                    </span>
                  ))}
              </div>
              <div className="mt-4">
                <StorageMeter bytes={stats.data.bytes} pagesLive={pages.data?.enabled === true && current === "pages"} />
              </div>
              {stats.data.largest.length ? (
                <details className="mt-4 text-[13px]">
                  <summary className="cursor-pointer select-none text-muted-foreground hover:text-foreground">Sabse badi files</summary>
                  <ul className="mt-2 space-y-1">
                    {stats.data.largest.map((f) => (
                      <li key={f.path} className="flex items-center justify-between gap-3">
                        <Link to="/v/$" params={{ _splat: f.path }} className="min-w-0 truncate text-foreground underline-offset-4 hover:underline">
                          {f.path}
                        </Link>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{formatBytes(f.size)}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </>
          ) : null}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="px-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Delivery</h2>
        <p className="mt-1 px-1 text-[13px] text-muted-foreground">
          jsDelivr poore repo ko sirf 50 MB tak serve karta hai. GitHub Pages usi repo ko 1 GB tak deliver karta hai — dono saath chal sakte hain.
        </p>
        <div className="mt-3 rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Globe className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium text-foreground">GitHub Pages</p>
              {pages.isPending ? (
                <Skeleton className="mt-1.5 h-4 w-40" />
              ) : pages.isError ? (
                <p className="mt-0.5 text-[12.5px] text-destructive">Status nahi mila — thodi der baad dobara dekho.</p>
              ) : pages.data?.enabled ? (
                <>
                  <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                    {pages.data.status === "built"
                      ? "Chalu hai · files live hain"
                      : pages.data.status === "errored"
                        ? "Chalu hai, par aakhri publish fail hua — GitHub par Pages tab dekho"
                        : "Chalu ho raha hai · pehli baar 1-2 minute lagte hain"}
                  </p>
                  <code className="mt-1.5 block truncate rounded-md bg-muted px-2 py-1 font-mono text-[11.5px] text-foreground/75">{pagesBaseUrl(repo)}/…</code>
                </>
              ) : (
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                  Abhi band hai. Ek tap mein chalu karo — repo mein bas ek chhoti <code className="font-mono">.nojekyll</code> file jayegi, baaki kuch nahi badlega.
                </p>
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {pages.data?.enabled ? (
              <>
                {current !== "pages" ? (
                  <Button
                    className="pressable h-10 rounded-lg"
                    disabled={actions.busy || pages.data.status !== "built"}
                    onClick={() => {
                      haptic("selection");
                      void actions.setLinkStyle("pages");
                    }}
                  >
                    Default link Pages karo
                  </Button>
                ) : (
                  <span className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent px-3 text-[13.5px] font-medium text-accent-foreground">
                    <Check className="h-4 w-4" /> Default link Pages hai
                  </span>
                )}
                {pages.data.url ? (
                  <Button asChild variant="outline" className="pressable h-10 rounded-lg">
                    <a href={pages.data.url} target="_blank" rel="noopener noreferrer">
                      Site kholo
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                ) : null}
              </>
            ) : (
              <Button
                className="pressable h-10 rounded-lg"
                disabled={actions.busy || pages.isPending || !session.githubConfigured}
                onClick={() => {
                  haptic("medium");
                  void actions.enablePages();
                }}
              >
                {actions.busy ? "Chalu ho raha hai…" : "GitHub Pages chalu karo"}
              </Button>
            )}
          </div>
        </div>
        <DeliveryHealthCard className="mt-3" />
      </section>

      <section className="mt-8">
        <h2 className="px-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Maintenance</h2>
        <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          <ActionRow
            icon={<RefreshCw className="h-4 w-4" />}
            title="Library dobara padho"
            hint="GitHub par seedha kuch badla ho to yahan turant dikhega."
            action={
              <Button variant="outline" className="pressable h-10 rounded-lg" disabled={actions.busy} onClick={() => void actions.refresh()}>
                Refresh
              </Button>
            }
          />
          <ActionRow
            icon={<Zap className="h-4 w-4" />}
            title="CDN cache refresh"
            hint="Har file ka CDN link jsDelivr se dobara fetch hoga. Kabhi-kabhi hi zaroorat padti hai."
            action={
              <Button variant="outline" className="pressable h-10 rounded-lg" disabled={actions.busy} onClick={() => setPurgeOpen(true)}>
                Purge
              </Button>
            }
          />
          <ActionRow
            icon={<LogOut className="h-4 w-4" />}
            title="Sign out"
            hint="Is device par owner tools band ho jayenge."
            action={
              <Button
                variant="ghost"
                className="pressable h-10 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={actions.busy}
                onClick={async () => {
                  const ok = await actions.signOut();
                  if (ok) void navigate({ to: "/" });
                }}
              >
                Sign out
              </Button>
            }
          />
        </div>
      </section>

      <p className="mt-8 px-1 text-center text-[13px] text-muted-foreground">
        <Link to="/about" className="underline-offset-4 hover:underline">
          Ye system kaise kaam karta hai · limits
        </Link>
      </p>

      <AlertDialog open={purgeOpen} onOpenChange={setPurgeOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl">Poora CDN cache purge karein?</AlertDialogTitle>
            <AlertDialogDescription>
              Har file ke liye jsDelivr ko purge request jayegi. Links waise hi rahenge; agli baar khulne par thoda slow ho sakta hai.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 rounded-lg">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="pressable h-11 rounded-lg"
              onClick={(e) => {
                e.preventDefault();
                haptic("medium");
                void actions.purgeAll().then(() => setPurgeOpen(false));
              }}
            >
              {actions.busy ? "Purge ho raha hai…" : "Purge karo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/60 px-3 py-2.5">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

/**
 * Owner GitHub token: save/rotate it from inside the app. Stored AES-256-GCM
 * encrypted in the repo manifest, so a new token works immediately — no Vercel
 * env edit or redeploy needed.
 */
function GithubTokenSection() {
  const fetchStatus = useServerFn(getGithubTokenStatus);
  const doSave = useServerFn(saveGithubToken);
  const doClear = useServerFn(clearGithubToken);
  const qc = useQueryClient();
  const [token, setToken] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<null | "save" | "clear">(null);
  const status = useQuery({ queryKey: ["github-token-status"], queryFn: fetchStatus });
  const src = status.data?.source ?? "none";

  const save = async () => {
    if (!token.trim() || busy) return;
    haptic("light");
    setBusy("save");
    try {
      await doSave({ data: { token: token.trim() } });
      setToken("");
      await qc.invalidateQueries({ queryKey: ["github-token-status"] });
      await qc.invalidateQueries({ queryKey: ["session"] });
      haptic("medium");
      toast.success("GitHub token save ho gaya — ab upload turant chalega.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Token save nahi hua.");
      haptic("heavy");
    } finally {
      setBusy(null);
    }
  };

  const clear = async () => {
    if (busy) return;
    haptic("light");
    setBusy("clear");
    try {
      await doClear();
      await qc.invalidateQueries({ queryKey: ["github-token-status"] });
      await qc.invalidateQueries({ queryKey: ["session"] });
      toast.success("Saved token hata diya.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Token hata nahi paye.");
    } finally {
      setBusy(null);
    }
  };

  const statusText =
    src === "env"
      ? "Environment variable (GITHUB_TOKEN) se chal raha hai. Yahan naya token save karne ka asar tabhi hoga jab env wala hatao."
      : src === "saved"
        ? "App mein saved hai — yahin se kabhi bhi naya token daal sakte ho, Vercel chhoone ki zaroorat nahi."
        : "Set nahi hai — abhi library sirf padhi ja sakti hai. Neeche token save karo, upload turant chalu ho jayega.";

  return (
    <section className="mt-8">
      <h2 className="px-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">GitHub token</h2>
      <p className="mt-1 px-1 text-[13px] text-muted-foreground">
        Upload, rename aur Pages chalane ke liye chahiye. Yahan save karo — token lock karke library mein hi rakha jata hai.
      </p>
      <div className="mt-3 rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <KeyRound className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-medium text-foreground">Token ki sthiti</p>
            <p className={cn("mt-0.5 text-[12.5px]", src === "none" ? "text-destructive" : "text-muted-foreground")} role={src === "none" ? "alert" : undefined}>
              {status.isPending ? "Dekh rahe hain…" : statusText}
            </p>
          </div>
        </div>

        <form
          className="mt-4 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="relative">
            <Input
              type={show ? "text" : "password"}
              autoComplete="off"
              spellCheck={false}
              placeholder="github_pat_… ya ghp_…"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              aria-label="Naya GitHub token"
              className="h-11 rounded-lg pr-12 font-mono text-[13px]"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
              aria-label={show ? "Token chhupao" : "Token dikhao"}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="pressable h-11 flex-1 rounded-lg sm:flex-none sm:px-6" disabled={busy !== null || !token.trim()}>
              {busy === "save" ? "Save ho raha hai…" : "Token save karo"}
            </Button>
            {src === "saved" ? (
              <Button type="button" variant="outline" className="pressable h-11 rounded-lg" disabled={busy !== null} onClick={() => void clear()}>
                {busy === "clear" ? "Hata rahe hain…" : "Hatao"}
              </Button>
            ) : null}
          </div>
        </form>

        <details className="mt-4 rounded-xl bg-muted/50 p-3 text-[13px]">
          <summary className="cursor-pointer select-none font-medium text-foreground">Naya token kaise banayein? (2 minute)</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>
              GitHub par{" "}
              <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline-offset-4 hover:underline">
                Fine-grained token page
              </a>{" "}
              kholo (login zaroori).
            </li>
            <li>Token name: kuch bhi, jaise <code className="font-mono">library-upload</code>. Resource owner: apna account.</li>
            <li>Repository access: <b>Only select repositories</b> → <code className="font-mono">edu-pdfs</code>.</li>
            <li>Permissions → Repository → <b>Contents: Read and write</b>.</li>
            <li>Generate token → jo <code className="font-mono">github_pat_…</code> dikhe use upar paste karke Save karo.</li>
          </ol>
        </details>
      </div>
    </section>
  );
}

/**
 * Public address the viewer links are built on. Inside the Lovable preview the
 * page's own origin needs the owner's login, so without this every copied
 * viewer link is private — the section says so and offers the fix.
 */
function AppAddressSection({ saved, busy, onSave }: { saved: string | undefined; busy: boolean; onSave: (url: string) => Promise<unknown> }) {
  const origin = useOrigin();
  const [draft, setDraft] = useState(saved ?? "");
  useEffect(() => setDraft(saved ?? ""), [saved]);

  const onPreview = isPreviewOrigin(origin);
  const normalized = normalizeAppUrl(draft);
  const draftIsPreview = !!normalized && isPreviewOrigin(normalized);
  const dirty = (normalized ?? "") !== (saved ?? "");
  const canUseCurrent = !!origin && !onPreview && origin !== saved;

  return (
    <section className="mt-8">
      <h2 className="px-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Viewer link ka address</h2>
      <p className="mt-1 px-1 text-[13px] text-muted-foreground">
        "Viewer link" is app ke page par khulta hai. Yahan published address dalo taaki preview se copy kiya link bhi sabko khule.
      </p>
      <div className="mt-3 rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Link2 className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-medium text-foreground">App ka public address</p>
            {saved ? (
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                Abhi: <code className="font-mono text-foreground/80">{saved}</code> — viewer links isi par ban rahe hain.
              </p>
            ) : onPreview ? (
              <p role="alert" className="mt-0.5 text-[12.5px] text-destructive">
                Set nahi hai, aur aap preview mein ho — abhi copy kiye viewer links sirf aapko khulenge. Pehle app Publish karo, phir wo address yahan dalo.
              </p>
            ) : (
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">Set nahi hai — abhi isi page ka address use hota hai, jo theek hai.</p>
            )}
          </div>
        </div>

        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!normalized || draftIsPreview || busy) return;
            haptic("selection");
            void onSave(normalized);
          }}
        >
          <Input
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            placeholder="https://aapki-site.lovable.app"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="App ka public address"
            aria-invalid={!!draft.trim() && (!normalized || draftIsPreview)}
            className="h-11 rounded-lg font-mono text-[13px]"
          />
          <div className="flex gap-2">
            <Button type="submit" className="pressable h-11 flex-1 rounded-lg sm:flex-none" disabled={busy || !normalized || draftIsPreview || !dirty}>
              Save
            </Button>
            {saved ? (
              <Button type="button" variant="outline" className="pressable h-11 rounded-lg" disabled={busy} onClick={() => void onSave("")}>
                Hatao
              </Button>
            ) : null}
          </div>
        </form>

        {draft.trim() && !normalized ? (
          <p className="mt-2 text-[12.5px] text-destructive">Poora address likho, jaise https://files.example.com</p>
        ) : draftIsPreview ? (
          <p className="mt-2 text-[12.5px] text-destructive">Ye preview address hai — bahar walon ko nahi khulega. Publish ke baad wala address dalo.</p>
        ) : null}

        {canUseCurrent ? (
          <button
            type="button"
            className="mt-3 text-[13px] font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => setDraft(origin)}
          >
            Abhi wala address bharo ({origin.replace(/^https?:\/\//, "")})
          </button>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Storage meter against the limit that actually matters for the current
 * default link: jsDelivr stops serving the whole repo at 50 MB, GitHub Pages at ~1 GB.
 */
function StorageMeter({ bytes, pagesLive }: { bytes: number; pagesLive: boolean }) {
  const limit = pagesLive ? PAGES_SITE_LIMIT_BYTES : CDN_PACKAGE_LIMIT_BYTES;
  const pct = Math.min(100, Math.round((bytes / limit) * 100));
  const warn = !pagesLive && bytes >= CDN_PACKAGE_WARN_BYTES;
  const over = !pagesLive && bytes >= CDN_PACKAGE_LIMIT_BYTES;
  return (
    <div>
      <div className="flex items-center justify-between text-[12px] text-muted-foreground tabular-nums">
        <span>{pagesLive ? "GitHub Pages limit (1 GB)" : "jsDelivr CDN limit (50 MB poora repo)"}</span>
        <span>
          {formatBytes(bytes)} · {pct}%
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", warn ? "bg-destructive" : "bg-primary")} style={{ width: `${Math.max(2, pct)}%` }} />
      </div>
      {over ? (
        <p role="alert" className="mt-2 flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Repo jsDelivr ki 50 MB limit se upar hai. CDN links aaj chal rahe hain, par jsDelivr inhe kabhi bhi rok sakta hai — neeche GitHub Pages chalu rakho aur naye links Pages se do.</span>
        </p>
      ) : warn ? (
        <p className="mt-2 flex items-start gap-2 rounded-lg bg-accent/60 px-3 py-2 text-[13px] text-foreground/85">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <span>50 MB ke paas aa gaye — jsDelivr uske upar links rok sakta hai. Abhi GitHub Pages chalu kar lo; purane links tab bhi chalte rahenge.</span>
        </p>
      ) : null}
    </div>
  );
}

function ActionRow({ icon, title, hint, action }: { icon: React.ReactNode; title: string; hint: string; action: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-3.5 last:border-b-0">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium text-foreground">{title}</p>
        <p className="text-[12.5px] text-muted-foreground">{hint}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}
