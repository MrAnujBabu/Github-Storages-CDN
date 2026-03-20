# Naveen Bharat — Vercel Deployment Guide

## Prerequisites

- **Node.js** ≥ 18
- A **Vercel** account ([vercel.com](https://vercel.com))
- A **GitHub** repository connected to Vercel (or use Vercel CLI)

---

## Environment Variables

Set these in Vercel → Project → Settings → Environment Variables:

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon (public) key |

> ⚠️ Never add your GitHub PAT or Supabase service role key here — those are entered at runtime in the UI.

---

## Option 1: Deploy via Vercel Dashboard

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repo
3. Vercel auto-detects **Vite** — confirm these settings:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add environment variables (see above)
5. Click **Deploy**

---

## Option 2: Deploy via Vercel CLI

```bash
# Install CLI
npm i -g vercel

# Login
vercel login

# Deploy (from project root)
vercel

# For production
vercel --prod
```

---

## SPA Routing

The `vercel.json` file in the project root handles SPA routing:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

This ensures routes like `/viewer/abc123` work correctly on refresh.

---

## Custom Domain

1. Go to Vercel → Project → Settings → Domains
2. Add your domain (e.g., `files.naveenbharat.com`)
3. Update DNS records as instructed by Vercel
4. SSL is automatic

---

## Updating

Push to your connected GitHub branch and Vercel auto-deploys. That's it! 🚀
