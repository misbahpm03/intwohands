/* ============================================================================
   Photo and music uploads.

   The browser sends the file STRAIGHT to Blob; this route only issues a
   short-lived token. That is not a style choice: Vercel caps a serverless
   request body at 4.5 MB, and photos off a phone routinely exceed it, so
   proxying the bytes through a function would pass in testing and then fail
   on the real photographs.
   ==========================================================================*/

import { handleUpload } from "@vercel/blob/client";
import { isAdmin, readJson } from "./_auth.js";

/* Browsers and operating systems disagree about audio types: the same .mp3
   arrives as audio/mpeg or audio/mp3, an .m4a as audio/mp4 or audio/x-m4a,
   a .wav as audio/wav, audio/x-wav or audio/wave. Accept the lot. */
const ALLOWED = [
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/heic",
  "audio/mpeg", "audio/mp3", "audio/mp4", "audio/x-m4a", "audio/aac",
  "audio/ogg", "audio/opus", "audio/wav", "audio/x-wav", "audio/wave", "audio/flac",
];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method not allowed" });
  }

  const body = await readJson(req);

  try {
    const result = await handleUpload({
      request: req,
      body,
      onBeforeGenerateToken: async () => {
        /* the only thing standing between this and an open uploader */
        if (!isAdmin(req)) throw new Error("not signed in");
        return {
          allowedContentTypes: ALLOWED,
          maximumSizeInBytes: 25 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        /* nothing to do — the admin page writes the URL into content.json */
      },
    });

    return res.status(200).json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}
