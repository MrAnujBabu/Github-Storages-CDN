import { createFileRoute } from "@tanstack/react-router";

/**
 * Owner-only: hands the signed-in owner's browser the GitHub token + repo so
 * large files can be uploaded STRAIGHT to GitHub (blob API) without passing
 * through this server. Vercel/serverless request bodies are capped at ~4.5 MB,
 * which made any file larger than that fail with HTTP 413 — this endpoint is
 * the fix. The token only ever goes to the owner who already manages it in
 * Settings; it is never exposed to visitors.
 */
export const Route = createFileRoute("/api/upload-prepare")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { isOwnerRequest } = await import("@/lib/session.server");
        const { resolveGithubToken } = await import("@/lib/owner-token.server");
        const { resolveActiveRepo } = await import("@/lib/library.server");

        const json = (body: unknown, status = 200) =>
          new Response(JSON.stringify(body), {
            status,
            headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
          });

        // CSRF: only accept same-origin requests.
        const origin = request.headers.get("origin");
        const site = request.headers.get("sec-fetch-site");
        if (site && site !== "same-origin" && site !== "none") return json({ error: "Request accept nahi hui." }, 403);
        if (!origin && !site) return json({ error: "Request accept nahi hui." }, 403);
        if (origin) {
          const reqHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
          try {
            if (reqHost && new URL(origin).host !== reqHost) return json({ error: "Request accept nahi hui." }, 403);
          } catch {
            return json({ error: "Request accept nahi hui." }, 403);
          }
        }

        if (!(await isOwnerRequest(request))) {
          return json({ error: "Upload sirf owner kar sakta hai — pehle sign in karo." }, 401);
        }

        const token = await resolveGithubToken();
        if (!token) {
          return json({ error: "GitHub token set nahi hai — Settings mein token save karo." }, 503);
        }
        return json({ ok: true, token, repo: await resolveActiveRepo(true) });
      },
    },
  },
});
