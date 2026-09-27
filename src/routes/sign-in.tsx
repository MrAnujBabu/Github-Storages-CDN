import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/library/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOwner } from "@/hooks/useOwner";
import { haptic } from "@/lib/haptics";
import { signIn } from "@/lib/library.functions";
import { APP_NAME } from "@/lib/storage-config";

export const Route = createFileRoute("/sign-in")({
  head: () => ({
    meta: [
      { title: `Owner sign in — ${APP_NAME}` },
      { name: "description", content: "Library ka owner yahan passcode se sign in karke files upload aur arrange karta hai." },
      { property: "og:title", content: `Owner sign in — ${APP_NAME}` },
      { property: "og:description", content: "Owner passcode se sign in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SignInPage,
});

function SignInPage() {
  const { isOwner, session, loading } = useOwner();
  const doSignIn = useServerFn(signIn);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [passcode, setPasscode] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [onVercel, setOnVercel] = useState(false);
  useEffect(() => {
    setOnVercel(window.location.hostname.endsWith("vercel.app"));
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!passcode.trim() || busy) return;
    haptic("light");
    setBusy(true);
    setError(null);
    try {
      await doSignIn({ data: { passcode } });
      await qc.invalidateQueries({ queryKey: ["session"] });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["folder"] }),
        qc.invalidateQueries({ queryKey: ["file"] }),
        qc.invalidateQueries({ queryKey: ["browse"] }),
        qc.invalidateQueries({ queryKey: ["kind"] }),
      ]);
      haptic("medium");
      toast.success("Sign in ho gaya");
      void navigate({ to: "/files" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in nahi ho paaya.");
      haptic("heavy");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell compact>
      <div className="mx-auto mt-6 w-full max-w-sm sm:mt-14">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <KeyRound className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-2xl font-semibold text-foreground">Owner sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sirf owner files upload, rename aur arrange kar sakta hai. Dekhna aur link copy karna sabke liye khula hai.
          </p>

          {!loading && isOwner ? (
            <div className="mt-6 rounded-xl bg-accent/50 p-4 text-sm text-foreground">
              Aap pehle se sign in hain.
              <div className="mt-3 flex gap-2">
                <Button asChild className="pressable h-11 rounded-lg">
                  <Link to="/files">Library kholo</Link>
                </Button>
                <Button asChild variant="outline" className="pressable h-11 rounded-lg">
                  <Link to="/settings">Settings</Link>
                </Button>
              </div>
            </div>
          ) : !loading && session && !session.passcodeConfigured ? (
            <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-foreground">
              Owner passcode is site par abhi set nahi hua hai. Jahan ye site chal rahi hai, wahan ke environment
              variables mein <span className="font-mono">OWNER_PASSCODE</span> aur <span className="font-mono">SESSION_SECRET</span> add karo
              {onVercel
                ? " — Vercel dashboard → Project → Settings → Environment Variables mein, phir Redeploy karo"
                : " — Lovable project settings → Secrets mein"}
              . Uske baad yahan sign in hoga.
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="passcode">Passcode</Label>
                <div className="relative">
                  <Input
                    id="passcode"
                    type={show ? "text" : "password"}
                    autoComplete="current-password"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    className="h-12 rounded-lg pr-12 text-base"
                    autoFocus
                    enterKeyHint="go"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                    aria-label={show ? "Passcode chhupao" : "Passcode dikhao"}
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {error ? (
                  <p className="text-[13px] text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
              <Button type="submit" className="pressable h-12 w-full rounded-lg text-[15px]" disabled={busy || !passcode.trim()}>
                {busy ? "Check ho raha hai…" : "Sign in"}
              </Button>
            </form>
          )}
        </div>
        <p className="mt-4 text-center text-[13px] text-muted-foreground">
          <Link to="/about" className="underline-offset-4 hover:underline">
            Ye system kaise kaam karta hai?
          </Link>
        </p>
      </div>
    </AppShell>
  );
}
