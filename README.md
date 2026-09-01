# In Two Hands

An anniversary letter: paper and ink, written in two hands, that opens from a
postmarked envelope and writes itself as you scroll.

One repo backs **many letters**. Each couple is a separate Vercel project with
its own storage, its own password and its own domain. The code is shared; no
content ever is.

---

## The one rule

**Never put real names or a real story in `content.js`.**

That file is the shared template — it is what a brand-new deployment shows
before anyone has edited anything. Everything personal is entered at `/admin`
and saved to that deployment's own Blob storage.

Break this rule and the next couple's site opens with the previous couple's
name on the envelope.

---

## Spinning up a new letter

1. **Import the repo** into a new Vercel project. Vercel will mention the
   repository is already connected to another project — that's expected;
   continue.

2. **Create a NEW Blob store** for it (Storage → Create → Blob), then connect
   it to this project. Do not reuse another letter's store. This is the one
   click that matters: two projects sharing a store means two letters
   overwriting each other's `content.json`. (If it ever happens, set
   `BLOB_PREFIX` to something unique on one of them.)

3. **Set the environment variables** (see `.env.example`):
   - `ADMIN_PASSWORD` — the password for `/admin`
   - `ADMIN_SECRET` — any long random string; signs the admin cookie
   - `BLOB_READ_WRITE_TOKEN` — appears on its own when you connect the store

4. **Deploy.**

5. **Open `/admin`**, sign in, and fill it in — names, dates, the envelope,
   chapters, photographs, the letter, the closing. Press **save**. That first
   save is what copies the template into this deployment's storage.

6. **Optional — let them write back by email.** Sending uses
   [EmailJS](https://www.emailjs.com), configured entirely with environment
   variables so nothing appears in the page source:

   1. Connect an email service → copy the **Service ID**.
   2. Create a template with **`{{message}}`** in the body, and set the subject
      and recipient there → copy the **Template ID**.
   3. Account → API Keys → copy the **public key**, and the **private key** if
      your plan has one.
   4. Set `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID`, `EMAILJS_PUBLIC_KEY`
      and `EMAILJS_PRIVATE_KEY` on the Vercel project, then redeploy.

   EmailJS refuses calls from non-browser clients by default, and the relay
   function is one. Setting `EMAILJS_PRIVATE_KEY` is the way through; if your
   plan has no private key, tick **"Allow EmailJS API for non-browser
   applications"** in the dashboard and leave it unset.

   Without any of this the reply box still works and offers copy-to-clipboard
   instead — nothing looks broken.

---

## Where things live

| What | Where |
|---|---|
| The story, all of it | `content.json` in that project's Blob store |
| Uploaded photos and music | The same Blob store, with random suffixes |
| The template shown before the first save | `content.js` in Git |
| The admin password | `ADMIN_PASSWORD`, per project |
| The mail credentials | `EMAILJS_*`, per project — never in the page |
| Their reply, as they type it | Their own browser's `localStorage` |
| Their reply, once sent | Your email inbox, via EmailJS |

**To wipe a letter:** delete its Blob store and its Vercel project. Nothing
about it lives anywhere else.

---

## Running it locally

```bash
npm install
vercel env pull .env.local     # gets the real values, including the Blob token
vercel dev
```

Then `http://localhost:3000` for the letter, `/admin` to edit it.

Opening `index.html` straight off disk also works — it falls back to the
template in `content.js` — but the admin, saving and uploads all need
`vercel dev` because they're serverless functions.

## Tests

```bash
npm test                       # the admin cookie: signing, expiry, tampering
```

Open `/?selftest` in a browser and check the console for the letter's own
assertions — the day counter, the anniversary rollover, the send-button rules.

---

## Notes worth knowing

- **Their reply is sent server-side.** The browser posts to `/api/reply`,
  which relays to EmailJS using credentials the page never sees. That endpoint
  has to be public so they can send without logging in, so it caps the message
  length and checks the request came from your own domain — enough to stop
  casual abuse, not a determined person. The exposure is your EmailJS quota.
- **Photo uploads go straight from the browser to Blob.** Vercel caps a
  serverless request body at 4.5 MB and phone photos routinely exceed that, so
  `api/upload.js` only issues a token and never handles the bytes.
- **Nothing is permanent in `/admin` until you press save.** A delete you
  regret is undone by reloading without saving.
- **The letter fails open.** If `/api/content` is unreachable the page renders
  from the template rather than showing nothing, and the envelope can always be
  opened even with JavaScript broken.
- **Preview deployments share the project's production environment
  variables**, so a preview branch reads and writes that project's real story.
- **Bengali is supported** but there is no Bengali handwriting font in
  existence on Google Fonts — Bengali text falls through to calligraphic
  display faces (Galada, Alkatra). English keeps Caveat and Cedarville.
