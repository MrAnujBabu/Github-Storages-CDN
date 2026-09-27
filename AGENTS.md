<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Architecture rules

- GitHub repo (`STORAGE_REPO`, default `MrAnujBabu/edu-pdfs@main`) is the only source of truth; `.library/manifest.json` holds order/labels/hidden/aliases (capped 600)/settings — why: no database to drift.
- All GitHub calls via `github.server.ts` (gateway → env → owner token in manifest, rotatable in Settings) — why: writes need auth, reads never break.
- `loadSnapshot` caches 20 s; writes reload fresh first — why: rate limits vs. stale commits.
- Owner = passcode + `SESSION_SECRET` HMAC cookie (`isPasscodeConfigured` needs both); writes use `ownerOnly`; `/api/upload` checks cookie + same-origin — why: single owner, no accounts.
- Uploads: multipart route, ≤16 MB/4 files per request client-side, >40 MB multi-file rejected — why: Worker memory with base64 copies.
- Default link = GitHub Pages (`pagesBaseUrl`; owner switched Sep 26 2026, manifest `linkStyle: "pages"`); host keeps owner case, lowercase 404s; jsDelivr selectable, 50 MB cap.
- CDN purges are awaited — why: detached promises die with the Worker response.
- Name clashes are case-insensitive (`caseClash`); typed names pass `cleanFileName/FolderName`; `keepEmptiedFolders` re-adds `.keep` — why: git is case-sensitive and drops empty dirs, phones/CDNs are not.
- PDFs: react-pdf + pdf.js legacy build behind `<ClientOnly>` — why: modern build breaks on older phones.
- Copy is Hinglish; dialogs are bottom sheets on mobile; server fns use `.validator()`.
- Select mode: `FolderPage.tsx` Set of paths → `deleteMany`/`moveMany` (one commit) — why: tidy history and purges.
- `<html data-bottom-bar>` (AppShell) lifts sonner toasts above fixed bars — why: toasts must not cover actions.
- README "Setup after a reset" + `roadmap.md` "In progress" are the resume points; update both on connector/secret changes — why: two workspace moves lost connections.
- `/` is the Browse home (`BrowseHome` + `buildBrowse`), `/files` the root folder listing, `/c/$kind` per-type lists; recents live in localStorage (`useRecents`) — why: Google-Files-style entry screen with zero extra GitHub/Supabase reads.
- Library-wide link health = `getDeliveryHealth` → `checkDelivery` (4 files from `sampleFiles`, fixed public hosts only, 45 s cache per commit) rendered by `DeliveryHealthCard` (Settings full / home compact); per-file checks stay in `checkFileLinks` — why: visitors can see it, so it must never probe owner-configured origins or hidden files.
