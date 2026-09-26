- [x] Workspace move #3 (14:41 UTC, user message): GitHub API re-linked (`nb's GitHub API`, repo scope; GITHUB_API_KEY back)
- [x] Supabase "Github Storage" after workspace move #3 (14:44 UTC) — re-attached via secret rebind; github_settings row verified (`MrAnujBabu/edu-pdfs@main`); VITE_ env vars back in `.env`
- [ ] Resume-after-reset rule (user 13:28 UTC): memory + README + roadmap must let the next session continue exactly where credits ran out; keep roadmap.md as the single source of "next step"
- [x] After move #3: OWNER_PASSCODE / SESSION_SECRET still present (checked 14:44 UTC)
# Roadmap

## In progress
- [x] GOAL (user 13:32 UTC, screenshot Files_by_Google): "Files by Google" style home — `/` = Browse (search bar, "Abhi dekha" recents from localStorage, type tiles, collection cards, storage meter), `/c/$kind` per-type screens, `/files` = full root listing. All data from one GitHub snapshot read (`buildBrowse`/`kindListing`); Supabase untouched
- [x] Bring backup code (Back-up.zip) into this project; install deps
- [x] Default link style switched to GitHub Pages (owner OK, 14:32 UTC): manifest `settings.linkStyle` committed as `pages`; `pagesBaseUrl` keeps owner case (lowercase host 404s); code fallbacks default to `pages`; repo was 78.8 MB (past jsDelivr's 50 MB cap). Pages re-verified live (build queued, file 200)
- [x] Project moved to a new workspace (user 13:02 UTC) — GitHub API re-linked (nb's GitHub API, repo scope); SESSION_SECRET + OWNER_PASSCODE still present
- [x] SESSION_SECRET generated; OWNER_PASSCODE saved by user (verify after workspace move)
- [x] Finish "Select" mode (was half-done in backup): pick many → copy all links / move / delete in one commit
- [ ] Backup resilience (user 13:03 UTC): saved to memory; write README "Setup after reset" checklist (connector, secrets, storage repo) and keep it current
- [ ] Owner flow phone test: steps 1-6 pass (sign-in → naya folder auto-opens → upload → rename cleaning → delete files → empty folder survives). Step 7 pending: root row ka "More actions" button disabled rehta hai (busy flag stuck?) — fix, phir bulk/select cleanup + Test-flow-*/Dbg-* folders repo se hatao
- [ ] Skill-driven audit + polish (user 12:59 UTC): human-tone-ui, mobile-view-expert, soft-touch, senior-architect-audit, console-error-triage
- [ ] Research pass (subagent web research; Parallel/Perplexity connectors not in workspace): jsDelivr + GitHub limits re-check, "dynamic view" UX patterns → apply findings
- [ ] Simpler upload: drop zone + paste + camera on phone, per-file progress, clear "link ready" state (user: "Uploadation simple hona chahiye")
- [ ] Dynamic view: per-folder view/sort remembered, quick arrange (move up/down without drag), folder covers

## Blocked / needs user
- [ ] Supabase "Github Storage" (user 13:15 UTC: "connect") — now connected (ref nyqfqdoqsqoajqqeuzdi, old uploader tables: uploaded_pdfs, github_settings). Library does not need it; check old rows for anything worth importing (titles/folders); keep the build clean with the integration present.
- [ ] Git sync (code backup to GitHub): only the user can connect — Plus (+) menu → GitHub → Connect project.
- [ ] supabase-health-guardian / bandwidth-maintainer skills: N/A until a Supabase backend exists in this project.

## Ready
- [ ] Desktop folder tree sidebar for faster navigation in large libraries
- [ ] Capacitor Android wrapper (APK) once the web app is stable (capacitor-bun-apk-build skill)
- [ ] Head metadata check on every route (unique title/description/og)
