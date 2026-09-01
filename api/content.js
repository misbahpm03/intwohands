/* ============================================================================
   The story itself: one JSON object in Vercel Blob.

   GET  — public. Returns what's saved, or 204 when nothing has been saved
          yet, which tells the page to fall back to the seed in content.js.
   PUT  — admin only. Overwrites it.
   ==========================================================================*/

import { put, list } from "@vercel/blob";
import { isAdmin, readJson } from "./_auth.js";

/* One repo backs several deployments. Each normally has its OWN Blob store, so
   this fixed name is fine. BLOB_PREFIX is the escape hatch for the one mistake
   that would hurt: pointing two projects at a single store, where they would
   silently overwrite each other's story. Default empty — existing deployments
   keep the exact same path. */
const NAME = (process.env.BLOB_PREFIX || "") + "content.json";

/** Enough of a shape check that a bad save can't blank the letter. */
function invalid(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return "not an object";
  if (!data.names || !data.names.one || !data.names.two) return "names.one and names.two are required";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data.startDate || ""))) return "startDate must be YYYY-MM-DD";
  if (!Array.isArray(data.chapters)) return "chapters must be a list";
  if (!data.letter || !Array.isArray(data.letter.paragraphs)) return "letter.paragraphs must be a list";
  return null;
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    res.setHeader("Cache-Control", "no-store");
    try {
      const { blobs } = await list({ prefix: NAME, limit: 10 });
      const hit = blobs.find((b) => b.pathname === NAME);
      if (!hit) return res.status(204).end();          /* nothing saved yet */

      /* The blob URL is CDN-backed and the pathname never changes, so bust it
         with the upload time — otherwise a save can take minutes to show. */
      const stamp = encodeURIComponent(hit.uploadedAt || Date.now());
      const r = await fetch(`${hit.url}?v=${stamp}`, { cache: "no-store" });
      if (!r.ok) return res.status(204).end();

      return res.status(200).json(await r.json());
    } catch (err) {
      console.error("[content] read failed:", err);
      return res.status(204).end();                    /* the page uses the seed */
    }
  }

  if (req.method === "PUT" || req.method === "POST") {
    if (!isAdmin(req)) return res.status(401).json({ error: "not signed in" });

    const body = await readJson(req);
    const problem = invalid(body);
    if (problem) return res.status(400).json({ error: problem });

    try {
      const blob = await put(NAME, JSON.stringify(body, null, 2), {
        access: "public",
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 0,
      });
      return res.status(200).json({ ok: true, url: blob.url });
    } catch (err) {
      console.error("[content] write failed:", err);
      return res.status(500).json({ error: "could not save: " + err.message });
    }
  }

  return res.status(405).json({ error: "method not allowed" });
}
