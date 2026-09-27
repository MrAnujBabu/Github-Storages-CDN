# Roadmap

## In progress
- [x] Workspace move #7 (user 01:57 UTC Sep 27): connections wiped again — GitHub API, Parallel, Perplexity re-linked 02:0x UTC; token-card/setup-helper code pushed to `Github-Storages-CDN` (commit a0d6ee9); Vercel redeployed in ~20 s — live sign-in page shows Setup helper (64-hex string verified). Live owner features still wait on Vercel env `OWNER_PASSCODE` + `SESSION_SECRET` (owner-only step).
- [x] Workspace move #6 (01:46 UTC): GitHub API, Parallel, Perplexity re-linked; final E2E on preview passed (visitor hint → sign-in → Upload button → PDF upload 4.4 s → raw link %PDF → folder delete). Vercel still has no OWNER_PASSCODE (sign-in page shows setup notice).
- [x] Mobile setup + in-app token rotation (Sep 27 2026, user request "SESSION_SECRET aap banao / token app se save ho"): sign-in page got a Setup helper (on-device 64-char crypto string + copy for SESSION_SECRET, GitHub fine-grained token link, Vercel steps); Settings got a "GitHub token" card — token saved AES-256-GCM encrypted in manifest `ownerTokenEnc` (key from SESSION_SECRET), `github.server.ts` transport order now gateway → env → saved token, first save commits with a token override. No Vercel redeploy needed to rotate. tsgo clean; verified in preview. Vercel one-time setup still needs OWNER_PASSCODE + SESSION_SECRET (+ GITHUB_TOKEN optional now).
- [x] Final push (Sep 27 2026): 3 bug fixes (folder rename/move alias redirect, bulk-move self-move skip, strict upload origin check) + README/roadmap pushed to `Github-Storages-CDN` — commit 61d7984.
- [x] Workspace move #5 (user 17:31 UTC): new workspace — GitHub API, Parallel, Perplexity re-linked fresh (README step 2 updated). Library reads/uploads unaffected; next owner action to verify: sign-in + upload test.
- [x] Workspace move #4 (user 15:39 UTC, backup `link-free-files-main.zip`): code restored here, GitHub API re-linked ("NB's GitHub API"), repo audited, 2 commits pushed (1a65c26 sync, 44c4beb legacy cleanup + Vercel build fix).
- [x] Vercel site `github-storages-cdn.vercel.app`: HTTP 200 and serving 3af8392 (new About copy live). Owner features there need Vercel env vars `OWNER_PASSCODE`, `SESSION_SECRET`, `GITHUB_TOKEN` (only the owner can set them — DEPLOYMENT.md).
- [x] Admin login + PDF upload verify (user 15:50 UTC): `OWNER_PASSCODE` + `SESSION_SECRET` set; Playwright sign-in → upload → Raw/Pages/jsDelivr all 200 with %PDF- → test folder deleted (storage repo clean).
- [x] Link status panel (user 15:50 UTC): `DeliveryHealthCard` — Settings card (Pages / jsDelivr / raw / Statically, ok-count + median ms over 4 sampled public files) and a compact line under the home Storage meter; app address (`settings.appUrl`) UI already in Settings. Verified in preview 16:03 UTC (all 4 channels ok, 66–186 ms).
- [ ] Supabase "Github Storage" connect (user 15:42, 15:50, 16:03 UTC Sep 26; 02:00 UTC Sep 27) — external project (ref nyqfqdoqsqoajqqeuzdi); can only be attached by the owner in Project Settings → Connectors → Supabase (chat tools can only create a new empty Cloud project). Library does not need it. Told the user; keep the one-line answer ready.
- [x] Deep-verify help text (user 16:05 UTC, Perplexity + Parallel + live probes, 16:2x UTC): copy lived in `src/routes/about.tsx`, not settings. Findings: jsDelivr GitHub limits are 20 MB/file and 150 MB/package, its package API refuses this 145 MB repo ("configured limit of 50 MB") yet `/gh/` file URLs still return 200 (13 MB PDF served); commit-pinned URLs are cached forever in jsDelivr S3 (never purgeable); branch URLs cache 12 h (not "sometimes"); Pages limit is 1 GB published + 100 GB/month soft bandwidth; hidden files are gone from list/search AND `findFileDetail` blocks the viewer for visitors, but Pages/CDN/raw links still serve them. About copy + `storage-config.ts` comments corrected; added `CDN_FILE_LIMIT_BYTES`.
- [x] Push to `Github-Storages-CDN`: commit 3af8392 (health panel + corrected copy). Push helper must exclude `.git`, `.workspace/`, `tsconfig.tsbuildinfo` — a bare `.git` entry causes GitHub 422 "malformed path component".
- [x] Leftover `App-check-27814/` verification folder removed from the storage repo.
- [x] Code audit (16:34 UTC): 4 fixes — rename can no longer bypass the upload type allowlist (notes.pdf→notes.html XSS hole closed, `ALLOWED_FILE_EXTS` shared from storage-config), rename/move now purge the NEW path too (cached jsDelivr 404s), session tokens require a numeric `iat`, brute-force counter map capped at 5000 keys. tsgo + build clean.

## Blocked / needs user
- [ ] Git sync (auto code backup to GitHub): only the owner can connect — Plus (+) menu → GitHub → Connect project → pick `Github-Storages-CDN`.

## Ready
- [x] Owner flow phone test step 7 (16:45 UTC): "More actions" bug reproduce nahi hua — current code mein menu par koi disabled condition hai hi nahi; owner sign-in + 480px viewport par sab rows ke menu khulte hain (owner items sahit). Dbg-9790/9863/9893 aur Test-flow-29465/30348/30466/30590/30682 storage repo se delete kar diye.
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

- [x] Deep E2E test (Sep 26 2026): visitor pages phone+desktop, sign-in, upload, rename (.html blocked), hide, folder rename + old link, multi-move (1 commit), link health, bulk delete — all pass; test folders cleaned. Open: one unexplained 409 in console during owner run.

## Audit — Sep 27, 2026 (end-to-end test on the live site)
- [x] Fixed: Storage repos page showed "Repo ya file GitHub par nahi mili" on Vercel (trailing slash in the repo info request)
- [x] Fixed: web fonts never loaded in production (invalid Google Fonts URL for Fraunces axes)
- [x] Fixed: blob upload did not return the repo to the history logger (would have failed uploads once Supabase env is set)
- [x] History page now names exactly which Supabase variable is missing; accepts common aliases
- [x] Security headers on Vercel (nosniff, SAMEORIGIN, referrer policy, permissions policy, HSTS)
- [ ] Durable brute-force limit for the passcode (needs a shared store; in-memory resets per serverless instance)
- [ ] Magic-byte check on the blob upload path (only extension check today)
- [ ] Manifest compare-and-swap on retry (two tabs writing at once can overwrite each other's manifest change)
