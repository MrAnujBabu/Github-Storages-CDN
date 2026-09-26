# Deploying Naveen Bharat Files

The app is a TanStack Start (React 19 + Vite) project. It has **no database**: the public
GitHub repo `MrAnujBabu/edu-pdfs@main` is the library, and `.library/manifest.json` inside
it stores order, titles/notes, hidden items, aliases and settings.

There are two supported hosts.

## 1. Lovable (primary)

Publish from the Lovable editor. Lovable injects everything the server needs:

| Secret | Where it comes from |
| --- | --- |
| `GITHUB_API_KEY` | Connectors → GitHub (account that owns the storage repo, `repo` scope) |
| `LOVABLE_API_KEY` | automatic (connector gateway) |
| `OWNER_PASSCODE` | Project Settings → Secrets — the passcode typed on `/sign-in` |
| `SESSION_SECRET` | Project Settings → Secrets — random 64-char string that signs the owner cookie |
| `STORAGE_REPO` | optional, `owner/repo@branch`, only if the library is not `MrAnujBabu/edu-pdfs@main` |

## 2. Vercel (mirror of the code repo)

Vercel is connected to `MrAnujBabu/Github-Storages-CDN`. The build detects Vercel on its own
and emits a Build Output API v3 bundle (`.vercel/output`: static assets + one Node 22 function),
so no framework preset or output directory needs to be configured. `vercel.json` only pins
`bun install` / `bun run build`.

Set these in **Vercel → Project → Settings → Environment Variables** (Production):

| Variable | Value |
| --- | --- |
| `OWNER_PASSCODE` | the owner passcode (any strong string) |
| `SESSION_SECRET` | `openssl rand -hex 32` — different from Lovable's is fine; sessions are per host |
| `GITHUB_TOKEN` | a GitHub token for the owner account. Fine-grained: repository `edu-pdfs`, permissions **Contents: Read and write**, **Pages: Read and write** (optional, for the Pages status card). Classic: `repo` scope. |
| `STORAGE_REPO` | optional, see above |

Without `GITHUB_TOKEN` the site still browses and serves links (the repo is public, anonymous
API reads are cached for 20 s) but upload / rename / delete fail with a clear message.
Without `OWNER_PASSCODE` + `SESSION_SECRET` the sign-in page shows the setup hint instead.

`LOVABLE_API_KEY` / `GITHUB_API_KEY` are **not** used on Vercel — the app falls back to
`GITHUB_TOKEN` automatically (`src/lib/github.server.ts`).

### Checking a deploy

1. Vercel → Deployments: the build log should end with `Generated .vercel/output/nitro.json`.
2. Open the site: the Browse home (search bar, type tiles, storage meter) must appear — not the
   old "File Upload & CDN" page.
3. `/sign-in` → passcode → create a folder → upload a small PDF → copy link → open it.

### Limits that shape the numbers

- 48 MB per file (jsDelivr refuses ≥ 50 MB); 40 MB / 20 files per multi-file request
  (server memory with base64 copies); GitHub Pages site ≤ 1 GB, ~1 min publish delay.
