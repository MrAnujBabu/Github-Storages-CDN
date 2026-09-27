import { createFileRoute } from "@tanstack/react-router";

import { ALLOWED_FILE_EXTS, MAX_BATCH_BYTES, MAX_FILES_PER_UPLOAD, MAX_FILE_BYTES } from "@/lib/storage-config";

/**
 * Multipart upload endpoint used by the upload sheet (XHR, so the browser can
 * show real progress). Owner cookie required; same-origin only.
 *
 * Fields: folder (string), clean ("1" to slugify names), files (one or more)
 */
export const Route = createFileRoute("/api/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { isOwnerRequest } = await import("@/lib/session.server");
        const { uploadFiles, LibraryError } = await import("@/lib/library.server");
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

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return json({ error: "Upload data padh nahi paaye — dobara try karo." }, 400);
        }

        const folder = normalizePath(String(form.get("folder") ?? ""));
        if (!isSafePath(folder)) return json({ error: "Folder ka naam theek nahi hai." }, 400);
        const clean = String(form.get("clean") ?? "") === "1";

        const files = form.getAll("files").filter((f): f is File => f instanceof File);
        if (files.length === 0) return json({ error: "Koi file nahi mili." }, 400);
        if (files.length > MAX_FILES_PER_UPLOAD) {
          return json({ error: `Ek baar mein ${MAX_FILES_PER_UPLOAD} files tak upload karo.` }, 400);
        }
        // Worker memory is ~128 MB and every file is held as bytes + base64 at once,
        // so multi-file requests stay under MAX_BATCH_BYTES; a single file may use the full per-file cap.
        const total = files.reduce((n, f) => n + f.size, 0);
        if (files.length > 1 && total > MAX_BATCH_BYTES) {
          return json({ error: "Ek request mein 40 MB se zyada nahi — files chhote groups mein bhejo." }, 413);
        }

        // Only study-material formats; no HTML/SVG/scripts/executables.
        const startsWith = (b: Buffer, sig: number[]) => sig.every((v, i) => b[i] === v);
        const contentMatches = (ext: string, b: Buffer): boolean => {
          switch (ext) {
            case "pdf": return b.subarray(0, 1024).includes(Buffer.from("%PDF-"));
            case "png": return startsWith(b, [0x89, 0x50, 0x4e, 0x47]);
            case "jpg": case "jpeg": return startsWith(b, [0xff, 0xd8, 0xff]);
            case "gif": return startsWith(b, [0x47, 0x49, 0x46, 0x38]);
            case "webp": return startsWith(b, [0x52, 0x49, 0x46, 0x46]) && b.subarray(8, 12).toString("latin1") === "WEBP";
            case "docx": case "xlsx": case "pptx": case "odt": case "ods": case "odp": case "epub": case "zip":
              return startsWith(b, [0x50, 0x4b, 0x03, 0x04]);
            case "doc": case "xls": case "ppt": return startsWith(b, [0xd0, 0xcf, 0x11, 0xe0]);
            default: {
              // Text formats: reject markup that browsers could render as a page.
              const head = b.subarray(0, 2048).toString("utf8").toLowerCase();
              return !b.subarray(0, 2048).includes(0) && !/<(html|script|svg|iframe)\b/.test(head);
            }
          }
        };

        const incoming = [];
        for (const f of files) {
          if (f.size > MAX_FILE_BYTES) {
            return json({ error: `"${f.name}" 48 MB se badi hai — CDN itni badi file serve nahi karta.` }, 413);
          }
          if (f.size === 0) return json({ error: `"${f.name}" khaali file hai.` }, 400);
          const name = cleanFileName(f.name, { slug: clean });
          const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
          if (!ALLOWED_FILE_EXTS.has(ext)) {
            return json({ error: `"${f.name}" is type ki file upload nahi hoti — PDF, photo, doc, sheet ya slides bhejo.` }, 415);
          }
          const buf = Buffer.from(await f.arrayBuffer());
          if (!contentMatches(ext, buf)) {
            return json({ error: `"${f.name}" ka content uske naam (.${ext}) se match nahi karta.` }, 415);
          }
          incoming.push({ name, size: f.size, base64: buf.toString("base64") });
        }

        try {
          const result = await uploadFiles(folder, incoming);
          return json({ ok: true, ...result });
        } catch (err) {
          if (err instanceof LibraryError) return json({ error: err.message }, err.status);
          console.error("[upload] failed", err);
          return json({ error: "Upload beech mein ruk gaya — dobara try karo." }, 502);
        }
      },
    },
  },
});
