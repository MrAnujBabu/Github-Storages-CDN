# Naveen Bharat Files

PDFs, notes and images stored in a GitHub repo and delivered through GitHub Pages (jsDelivr still available as a link style). No database: the repo is the only source of truth, and `.library/manifest.json` inside it keeps the custom order, titles/notes, hidden items, rename aliases and settings.

- Storage repo: `MrAnujBabu/edu-pdfs@main` (override with the `STORAGE_REPO` secret, format `owner/repo@branch`)
- Default share link (owner switched Sep 26 2026): `https://MrAnujBabu.github.io/edu-pdfs/<folder>/<file>` — the Pages host keeps the owner's exact case (`mranjubabu.github.io` all-lowercase can 404)
- Old jsDelivr format still works as a link style: `https://cdn.jsdelivr.net/gh/MrAnujBabu/edu-pdfs@main/<folder>/<file>`
- Visitors: browse, view, copy links. Owner (passcode): upload, new folder, rename, move, arrange, title/note, hide, delete, bulk select.

## Setup after a reset (workspace move, new sandbox, fresh clone, credits ran out)

Everything the app needs is listed here so nothing is lost when the environment changes. Check each item, in this order:

0. **Resume, don't restart** — open `roadmap.md`: "In progress" is the exact next step. Finished items stay finished.
1. **Code** — if the project is blank, restore it from the code repo `MrAnujBabu/Github-Storages-CDN@main` (or the latest backup zip): copy everything except `.git`, `.lovable/`, `node_modules/`, `.env`, then `bun install`. The repo mirrors this project; `src/routeTree.gen.ts` regenerates itself.
2. **GitHub API connector** — Lovable → Connectors → GitHub → connect the account that owns the storage repo, with `repo` scope. This creates the `GITHUB_API_KEY` secret. Without it the library still *reads* (public repo) but upload / rename / delete fail. (Lost on every workspace move so far — re-link first. Move #5, Sep 26 2026 17:31 UTC: re-linked fresh in the new workspace.) Research connectors Perplexity and Parallel were also re-linked fresh at the same time (both Lovable-managed; they only power chat-time research, not app features).
3. **Secrets** (Project Settings → Secrets):
   - `OWNER_PASSCODE` — the passcode typed on `/sign-in`. Only the owner knows it; choose a new one if lost.
   - `SESSION_SECRET` — random 64-char string used to sign the owner cookie. Generate a fresh one; old sessions simply expire.
   - `STORAGE_REPO` — optional, only if the storage repo is not `MrAnujBabu/edu-pdfs@main`.
   - `LOVABLE_API_KEY` — provided by Lovable automatically (used by the connector gateway).
4. **Storage repo** must exist and be public (jsDelivr only serves public repos). Files up to 48 MB each. GitHub Pages is enabled on it (Settings → Delivery) as the fallback once the repo passes jsDelivr's 50 MB whole-repo limit.
5. **Supabase project "Github Storage"** (optional, ref `nyqfqdoqsqoajqqeuzdi`) — holds the *old* uploader's tables (`uploaded_pdfs`, `github_settings`). The library does not read it. Only the owner can attach it (Project Settings → Connectors → Supabase); it cannot be linked from chat and Lovable Cloud would create a *different*, empty project.
6. **Verify**: open `/sign-in`, sign in, create a test folder, upload one file, copy its link, open the link, delete the folder.

## Code repo and the Vercel site

- Code repo: `MrAnujBabu/Github-Storages-CDN@main` — a mirror of this project pushed from Lovable via the GitHub API (one commit per sync; `gh_commit`-style Git Data API: blobs → tree → commit → ref). Only the owner can turn on automatic Git sync: editor → Plus (+) → GitHub → Connect project.
- Live site: `https://github-storages-cdn.vercel.app` (Vercel, connected to that repo). The build auto-targets Vercel (`.vercel/output`, Node 22 function) — see `DEPLOYMENT.md` for the three env vars Vercel needs (`OWNER_PASSCODE`, `SESSION_SECRET`, `GITHUB_TOKEN`). Without them the site is read-only.
- Sep 26 2026 audit: the repo still carried the *old* Vite/Supabase uploader (`index.html`, `src/main.tsx`, `postcss.config.js`, `package-lock.json`, SPA `vercel.json` …), which made every Vercel build fail, so the site kept serving the March app. Those files were removed in the "Remove legacy uploader" commit; they stay in git history if ever needed.

## Where things live

| What | Where |
| --- | --- |
| GitHub calls (Git Data API, one commit per action) | `src/lib/github.server.ts` |
| Folder/file read models, writes, bulk actions | `src/lib/library.server.ts` |
| Server functions (public reads, owner-only writes) | `src/lib/library.functions.ts` |
| Multipart upload route with progress | `src/routes/api/upload.ts` |
| Manifest (order, labels, hidden, aliases, settings) | `src/lib/manifest.ts` |
| Link formats (CDN, pinned, raw, statically, GitHub, viewer) | `src/lib/links.ts` |
| Owner session (passcode → HMAC cookie) | `src/lib/session.server.ts` |
| Screens | `src/routes/*.tsx`, `src/components/library/*` |

## Limits (why the numbers are what they are)

- 48 MB per file: jsDelivr refuses files over 50 MB.
- 50 MB per *repo* on jsDelivr (`/gh/` "package size" limit, enforced inconsistently). Settings shows a meter, warns at 40 MB. Fallback: GitHub Pages link (`https://<owner>.github.io/<repo>/<path>`, ~1 GB site limit, ~1 min publish delay).
- 40 MB per multi-file upload request, 20 files per request: Cloudflare Worker memory (~128 MB) with base64 copies.
- Branch links are purged on jsDelivr after upload/rename/delete so changes show within seconds.

## Local development

```sh
bun install
bun run dev
```

Runs on http://localhost:8080. Server secrets are read inside server functions only.
