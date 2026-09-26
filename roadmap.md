# Roadmap

## In progress
- [x] Workspace move #4 (user 15:39 UTC, backup `link-free-files-main.zip`): code restored here, GitHub API re-linked ("NB's GitHub API"), repo audited, 2 commits pushed (1a65c26 sync, 44c4beb legacy cleanup + Vercel build fix).
- [x] Vercel site `github-storages-cdn.vercel.app`: HTTP 200 and serving 3af8392 (new About copy live). Owner features there need Vercel env vars `OWNER_PASSCODE`, `SESSION_SECRET`, `GITHUB_TOKEN` (only the owner can set them — DEPLOYMENT.md).
- [x] Admin login + PDF upload verify (user 15:50 UTC): `OWNER_PASSCODE` + `SESSION_SECRET` set; Playwright sign-in → upload → Raw/Pages/jsDelivr all 200 with %PDF- → test folder deleted (storage repo clean).
- [x] Link status panel (user 15:50 UTC): `DeliveryHealthCard` — Settings card (Pages / jsDelivr / raw / Statically, ok-count + median ms over 4 sampled public files) and a compact line under the home Storage meter; app address (`settings.appUrl`) UI already in Settings. Verified in preview 16:03 UTC (all 4 channels ok, 66–186 ms).
- [ ] Supabase "Github Storage" connect (user 15:42, 15:50, 16:03 UTC) — external project (ref nyqfqdoqsqoajqqeuzdi); can only be attached by the owner in Project Settings → Connectors → Supabase (chat tools can only create a new empty Cloud project). Library does not need it. Told the user; keep the one-line answer ready.
- [x] Deep-verify help text (user 16:05 UTC, Perplexity + Parallel + live probes, 16:2x UTC): copy lived in `src/routes/about.tsx`, not settings. Findings: jsDelivr GitHub limits are 20 MB/file and 150 MB/package, its package API refuses this 145 MB repo ("configured limit of 50 MB") yet `/gh/` file URLs still return 200 (13 MB PDF served); commit-pinned URLs are cached forever in jsDelivr S3 (never purgeable); branch URLs cache 12 h (not "sometimes"); Pages limit is 1 GB published + 100 GB/month soft bandwidth; hidden files are gone from list/search AND `findFileDetail` blocks the viewer for visitors, but Pages/CDN/raw links still serve them. About copy + `storage-config.ts` comments corrected; added `CDN_FILE_LIMIT_BYTES`.
- [x] Push to `Github-Storages-CDN`: commit 3af8392 (health panel + corrected copy). Push helper must exclude `.git`, `.workspace/`, `tsconfig.tsbuildinfo` — a bare `.git` entry causes GitHub 422 "malformed path component".
- [x] Leftover `App-check-27814/` verification folder removed from the storage repo.
- [x] Code audit (16:34 UTC): 4 fixes — rename can no longer bypass the upload type allowlist (notes.pdf→notes.html XSS hole closed, `ALLOWED_FILE_EXTS` shared from storage-config), rename/move now purge the NEW path too (cached jsDelivr 404s), session tokens require a numeric `iat`, brute-force counter map capped at 5000 keys. tsgo + build clean.

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
