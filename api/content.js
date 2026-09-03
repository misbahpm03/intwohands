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

/** True only for a real calendar date written YYYY-MM-DD. */
export function realDate(value) {
  const s = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  /* rejects 2019-13-45, which the regex alone lets through and which then
     rolls over silently into a wrong day count on the letter */
  return date.getUTCFullYear() === y
      && date.getUTCMonth() === m - 1
      && date.getUTCDate() === d;
}

/* Enough of a shape check that a bad save can't blank the letter — which
   means checking the letter actually HAS something in it, not just that the
   field is the right type. The wording is what the editor shows in its status
   bar, so it names what someone sees on screen, not the JSON path. */
export function invalid(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return "that isn't a letter";
  if (!data.names || !data.names.one || !data.names.two) {
    return "your name and their name can't be empty";
  }
  if (!realDate(data.startDate)) {
    return "the date it started isn't a real date";
  }
  if (!Array.isArray(data.chapters)) return "the chapters are missing";
  if (!data.letter || !Array.isArray(data.letter.paragraphs) || !data.letter.paragraphs.length) {
    return "the letter itself can't be empty";
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    res.setHeader("Cache-Control", "no-store");
    try {
      const { blobs } = await list({ prefix: NAME, limit: 10 });
      const hit = blobs.find((b) => b.pathname === NAME);

      /* 204 means one thing and one thing only: nothing has ever been saved.
         A read that FAILED must not look the same, or the editor loads the
         starter template over a letter that exists and the next save
         overwrites it. Failures are 503 — see loadDraft in admin/admin.js. */
      if (!hit) return res.status(204).end();

      /* The blob URL is CDN-backed and the pathname never changes, so bust it
         with the upload time — otherwise a save can take minutes to show. */
      const stamp = encodeURIComponent(hit.uploadedAt || Date.now());
      const r = await fetch(`${hit.url}?v=${stamp}`, { cache: "no-store" });
      if (!r.ok) {
        console.error("[content] blob fetch failed:", r.status);
        return res.status(503).json({ error: "could not read the saved letter" });
      }

      return res.status(200).json(await r.json());
    } catch (err) {
      console.error("[content] read failed:", err);
      return res.status(503).json({ error: "could not read the saved letter" });
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
