import { createFileRoute } from "@tanstack/react-router";

import { ALLOWED_FILE_EXTS, MAX_FILES_PER_UPLOAD, MAX_FILE_BYTES } from "@/lib/storage-config";

/**
 * Second half of the direct-upload flow: the browser has already pushed each
 * file's bytes straight to GitHub as a blob (see /api/upload-prepare), so this
 * endpoint only receives tiny JSON — names, sizes and blob shas — and commits
 * them into the library tree. Owner cookie required; same-origin only.
 *
 * Body: { folder: string, clean: boolean, files: [{ name, size, blobSha }] }
 */
export const Route = createFileRoute("/api/upload-finish")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { isOwnerRequest } = await import("@/lib/session.server");
        const { uploadBlobFiles, LibraryError } = await import("@/lib/library.server");
        const { cleanFileName, isSafePath, normalizePath } = await import("@/lib/paths");

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

        let body: { folder?: unknown; clean?: unknown; files?: unknown };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return json({ error: "Upload data padh nahi paaye — dobara try karo." }, 400);
        }

        const folder = normalizePath(String(body?.folder ?? ""));
        if (!isSafePath(folder)) return json({ error: "Folder ka naam theek nahi hai." }, 400);
        const clean = body?.clean === true;

        const rawFiles = Array.isArray(body?.files) ? body.files : [];
        if (rawFiles.length === 0) return json({ error: "Koi file nahi mili." }, 400);
        if (rawFiles.length > MAX_FILES_PER_UPLOAD) {
          return json({ error: `Ek baar mein ${MAX_FILES_PER_UPLOAD} files tak upload karo.` }, 400);
        }

        const incoming: { name: string; size: number; blobSha: string }[] = [];
        for (const raw of rawFiles) {
          const f = raw as { name?: unknown; size?: unknown; blobSha?: unknown };
          const blobSha = String(f?.blobSha ?? "");
          if (!/^[0-9a-f]{40}$/i.test(blobSha)) {
            return json({ error: "Upload data adhoora mila — dobara try karo." }, 400);
          }
          const size = Number(f?.size);
          if (!Number.isFinite(size) || size <= 0) return json({ error: "Khaali file upload nahi hoti." }, 400);
          if (size > MAX_FILE_BYTES) {
            return json({ error: `"${String(f?.name ?? "file")}" 48 MB se badi hai — CDN itni badi file serve nahi karta.` }, 413);
          }
          const name = cleanFileName(String(f?.name ?? ""), { slug: clean });
          const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
          if (!ALLOWED_FILE_EXTS.has(ext)) {
            return json({ error: `"${name}" is type ki file upload nahi hoti — PDF, photo, doc, sheet ya slides bhejo.` }, 415);
          }
          incoming.push({ name, size, blobSha: blobSha.toLowerCase() });
        }

        try {
          const result = await uploadBlobFiles(folder, incoming);
          return json({ ok: true, ...result });
        } catch (err) {
          if (err instanceof LibraryError) return json({ error: err.message }, err.status);
          console.error("[upload-finish] failed", err);
          return json({ error: "Upload beech mein ruk gaya — dobara try karo." }, 502);
        }
      },
    },
  },
});
