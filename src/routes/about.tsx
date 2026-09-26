import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Cloud, Github, Link2, ListOrdered } from "lucide-react";

import { AppShell, PageTitle } from "@/components/library/AppShell";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/storage-config";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: `Kaise kaam karta hai — ${APP_NAME}` },
      { name: "description", content: "GitHub par files, jsDelivr CDN se delivery, aur is app se arrange + link copy. Limits aur tips." },
      { property: "og:title", content: `Kaise kaam karta hai — ${APP_NAME}` },
      { property: "og:description", content: "GitHub storage + CDN delivery model, simple bhasha mein." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AboutPage,
});

const STEPS = [
  {
    icon: Github,
    title: "Files GitHub par rehti hain",
    body: "Har PDF ya image ek public GitHub repo mein commit hoti hai. Koi database nahi — folder structure hi library hai, aur order/labels ek chhoti manifest file mein save hote hain.",
  },
  {
    icon: Cloud,
    title: "CDN se deliver hoti hain",
    body: "jsDelivr GitHub se file uthakar duniya bhar ke servers par cache karta hai. Isliye link fast khulta hai aur GitHub par load nahi padta.",
  },
  {
    icon: ListOrdered,
    title: "Yahan arrange hoti hain",
    body: "Owner folders banata hai, files ka sequence drag karke set karta hai, title/note lagata hai. Visitors ko wahi order dikhta hai.",
  },
  {
    icon: Link2,
    title: "Link ek tap mein",
    body: "Har row par link button hai. Default CDN link wahi format hai jo pehle se chal raha tha — purane links waise hi kaam karte rahenge.",
  },
];

const LIMITS = [
  ["File size", "48 MB tak. jsDelivr CDN sirf 20 MB tak ki ek file deta hai — usse badi file Pages ya Raw link se bhejo. Badi PDF compress ya split karna behtar hai."],
  ["CDN limit", "jsDelivr GitHub repo ke liye ~150 MB tak hi banaya gaya hai aur uski listing 50 MB ke baad ruk jati hai. File links uske baad bhi mil jate hain, par bharosa GitHub Pages par karo."],
  ["Bada repo", "GitHub Pages default hai: 1 GB tak deliver hota hai, naya file lagbhag 1 minute mein live. Library abhi ~145 MB par hai aur Pages link theek chal rahe hain."],
  ["Naya content", "Branch wala CDN link 12 ghante tak purana version dikha sakta hai; app khud purge bhejta hai. Pakka chahiye to \"Permanent CDN link\" copy karo."],
  ["Rename / delete", "Purana link band ho jata hai — naya link dobara share karo. Viewer link purane naam se bhi redirect ho jata hai."],
  [
    "Privacy",
    "Repo public hai. \"Visitors se chhupao\" wali file list, search aur app ke viewer page se gayab ho jati hai, par uska GitHub / Pages / CDN link kisi ke paas ho to wahan se khul jayegi. Sach mein private chahiye to file hata do.",
  ],
];

function AboutPage() {
  return (
    <AppShell compact>
      <PageTitle title="Ye system kaise kaam karta hai" note="Do line mein: storage GitHub ka, delivery CDN ki, control aapka." />

      <ol className="mt-6 grid gap-3 sm:grid-cols-2">
        {STEPS.map((s, i) => (
          <li key={s.title} className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <s.icon className="h-5 w-5" />
              </span>
              <span className="font-mono text-[12px] text-muted-foreground">0{i + 1}</span>
            </div>
            <h2 className="mt-3 text-[16px] font-semibold text-foreground">{s.title}</h2>
            <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">{s.body}</p>
          </li>
        ))}
      </ol>

      <section className="mt-8">
        <h2 className="px-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Limits jo yaad rakhni hain</h2>
        <dl className="mt-3 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          {LIMITS.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[110px_minmax(0,1fr)] gap-3 border-b border-border px-4 py-3 last:border-b-0 sm:grid-cols-[160px_minmax(0,1fr)]">
              <dt className="text-[14px] font-medium text-foreground">{k}</dt>
              <dd className="text-[14px] leading-relaxed text-muted-foreground">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-8 rounded-2xl border border-border bg-accent/40 p-5">
        <h2 className="text-[16px] font-semibold text-foreground">Link formats</h2>
        <ul className="mt-2 space-y-1.5 text-[14px] text-foreground/85">
          <li>
            <span className="font-medium">GitHub Pages link</span> — <code className="font-mono text-[12.5px]">owner.github.io/repo/…</code> — default; 1 GB tak ki library aur badi files par bhi chalta hai. Naya file aane ke baad ~1 minute leta hai.
          </li>
          <li>
            <span className="font-medium">CDN link</span> — <code className="font-mono text-[12.5px]">cdn.jsdelivr.net/gh/owner/repo@main/…</code> — purana format; ek file 20 MB tak, aur bade repo par jsDelivr kabhi block kar sakta hai. Branch link 12 ghante tak cache rehta hai.
          </li>
          <li>
            <span className="font-medium">Permanent CDN link</span> — commit se bandha; file replace hone par bhi wahi purana version deta hai (jsDelivr ise hamesha ke liye store kar leta hai, purge nahi hota).
          </li>
          <li>
            <span className="font-medium">Viewer link</span> — is app ka page; mobile par PDF seedha khulti hai, agli/pichli file ke buttons ke saath. Chhupayi hui file ka viewer link visitors ke liye nahi khulta.
          </li>
        </ul>
      </section>

      <div className="mt-8 flex justify-center">
        <Button asChild className="pressable h-11 rounded-lg px-5">
          <Link to="/">
            Library kholo
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </AppShell>
  );
}
