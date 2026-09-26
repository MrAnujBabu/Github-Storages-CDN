# Roadmap

## In progress
- [x] Workspace move #4 (user 15:39 UTC, backup `link-free-files-main.zip`): code restored here, GitHub API re-linked ("NB's GitHub API"), repo audited, 2 commits pushed (1a65c26 sync, 44c4beb legacy cleanup + Vercel build fix).
- [ ] Vercel site `github-storages-cdn.vercel.app` (user 15:50 UTC: "recent changes verify"): wait for the rebuild after 44c4beb, confirm the Browse home replaces the old uploader. Owner features there need Vercel env vars `OWNER_PASSCODE`, `SESSION_SECRET`, `GITHUB_TOKEN` (only the owner can set them — DEPLOYMENT.md).
- [x] Admin login + PDF upload verify (user 15:50 UTC): `OWNER_PASSCODE` + `SESSION_SECRET` set; Playwright sign-in → upload → Raw/Pages/jsDelivr all 200 with %PDF- → test folder deleted (storage repo clean).
- [x] Link status panel (user 15:50 UTC): `DeliveryHealthCard` — Settings card (Pages / jsDelivr / raw / Statically, ok-count + median ms over 4 sampled public files) and a compact line under the home Storage meter; app address (`settings.appUrl`) UI already in Settings. Verified in preview 16:03 UTC (all 4 channels ok, 66–186 ms).
- [ ] Supabase "Github Storage" connect (user 15:42, 15:50, 16:03 UTC) — external project (ref nyqfqdoqsqoajqqeuzdi); can only be attached by the owner in Project Settings → Connectors → Supabase (chat tools can only create a new empty Cloud project). Library does not need it. Told the user; keep the one-line answer ready.
- [ ] Deep-verify Settings help text (user 16:05 UTC, Perplexity + Parallel): Privacy claim (public repo, hidden files still open by direct link) and the 4 link-format claims — Pages works past repo size, jsDelivr 50 MB repo cap, commit-pinned CDN link stays fixed after replace, viewer link opens PDF on mobile with prev/next. Cross-check docs via connectors + live probes; fix any wrong copy in `settings.tsx`.
- [ ] Push link status panel commit to `Github-Storages-CDN` (Git Data API via GitHub connector; helper script was lost with /tmp) and confirm Vercel rebuild.
- [ ] Code audit findings (background review) → fix critical/high in this run, note the rest under Ready.

## Blocked / needs user
- [ ] Git sync (auto code backup to GitHub): only the owner can connect — Plus (+) menu → GitHub → Connect project → pick `Github-Storages-CDN`.

## Ready
- [ ] Owner flow phone test step 7: root row "More actions" stays disabled (busy flag?) — fix, then remove Test-flow-*/Dbg-* folders from storage repo.
- [ ] Simpler upload: drop zone + paste + camera on phone, per-file progress, clear "link ready" state.
- [ ] Dynamic view: per-folder view/sort remembered, quick arrange (up/down), folder covers.
- [ ] Desktop folder tree sidebar for large libraries.
- [ ] Head metadata check on every route (unique title/description/og).
- [ ] Capacitor Android wrapper (APK) once web app is stable.
- [ ] Multi-repo storage (same account) when library nears ~800 MB (Pages 1 GB cap).

## Done
- [x] Workspace move #3 (14:41 UTC): GitHub API re-linked; Supabase re-attached; secrets verified
- [x] "Files by Google" style home (`/` Browse, `/c/$kind`, `/files`)
- [x] Default link style → GitHub Pages (repo past jsDelivr 50 MB cap); Pages verified live
- [x] Select mode: multi copy / move / delete in one commit
- [x] Code synced to `Github-Storages-CDN` (14:50 UTC commit "Sync from Lovable: Browse home, Pages links, security fixes")
