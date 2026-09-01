/* ============================================================================
   Sending her reply, via EmailJS.

   The browser never talks to EmailJS. It posts here, and this function relays
   using credentials that live only in environment variables — so nothing about
   your mail setup appears in the page source.

     GET   → { configured: true|false }   how the page decides what to offer
     POST  { message }                    → { ok: true }

   EmailJS answers in text/html ("OK" on success, a sentence on failure), which
   is why the response is read with .text() and never .json().
   ==========================================================================*/

import { readJson } from "./_auth.js";

const ENDPOINT = "https://api.emailjs.com/api/v1.0/email/send";
const MAX_LENGTH = 5000;

const config = () => ({
  service_id: process.env.EMAILJS_SERVICE_ID || "",
  template_id: process.env.EMAILJS_TEMPLATE_ID || "",
  user_id: process.env.EMAILJS_PUBLIC_KEY || "",
  /* Optional. EmailJS blocks non-browser callers unless you send the private
     key as accessToken, or tick "Allow EmailJS API for non-browser
     applications" in the dashboard. Both routes work; this supports either. */
  accessToken: process.env.EMAILJS_PRIVATE_KEY || "",
});

const isConfigured = (c) => Boolean(c.service_id && c.template_id && c.user_id);

/** Casual abuse protection. Forgeable by anyone determined, and that's stated. */
function sameOrigin(req) {
  const host = req.headers.host;
  const src = req.headers.origin || req.headers.referer || "";
  if (!host || !src) return false;
  try {
    return new URL(src).host === host;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    return res.status(200).json({ configured: isConfigured(config()) });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "method not allowed" });
  }

  if (!sameOrigin(req)) {
    return res.status(403).json({ error: "that request didn't come from the letter" });
  }

  const cfg = config();
  if (!isConfigured(cfg)) {
    return res.status(503).json({ error: "sending isn't set up on this deployment" });
  }

  const { message } = await readJson(req);
  const text = typeof message === "string" ? message.trim() : "";

  if (!text) return res.status(400).json({ error: "nothing to send" });
  if (text.length > MAX_LENGTH) {
    return res.status(413).json({ error: "that's longer than this can send" });
  }

  const payload = {
    service_id: cfg.service_id,
    template_id: cfg.template_id,
    user_id: cfg.user_id,
    template_params: { message: text },
  };
  if (cfg.accessToken) payload.accessToken = cfg.accessToken;

  try {
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = (await r.text()).trim();   /* text/html, never JSON */

    if (!r.ok) {
      /* Logged here, not returned — a misconfigured template shouldn't spill
         its internals onto the page. The message itself is never logged. */
      console.error("[reply] EmailJS refused:", r.status, body);
      return res.status(502).json({ error: "the mail service refused it" });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[reply] send failed:", err.message);
    return res.status(502).json({ error: "could not reach the mail service" });
  }
}
