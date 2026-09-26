# Roadmap

## In progress
- [ ] Workspace move #4 (user 15:39 UTC, backup `link-free-files-main.zip`): restore code here, re-link GitHub API, deep-audit `MrAnujBabu/Github-Storages-CDN`, push the newer code there (add/update only, no deletes without owner OK). Then update README "Setup after a reset".
- [ ] Supabase "Github Storage" connect (user 15:42 UTC) — external project (ref nyqfqdoqsqoajqqeuzdi); can only be attached by the owner in Project Settings → Connectors → Supabase. Library does not need it; document + tell user.
- [ ] Secrets after move #4: `OWNER_PASSCODE`, `SESSION_SECRET` missing in this workspace → generate SESSION_SECRET, ask owner for passcode (`add_secret`).
- [ ] Deep linking (user 15:11 UTC): done in code (live link check, `?page=N`, Web Share, `settings.appUrl`). Pending: Settings UI for app address, docs, browser check.

## Blocked / needs user
- [ ] Git sync (auto code backup to GitHub): only the owner can connect — Plus (+) menu → GitHub → Connect project → pick `Github-Storages-CDN`.
- [ ] `OWNER_PASSCODE`: only the owner knows it.

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
