/* ============================================================================
   IN TWO HANDS — the editor

   Edits a working copy of the story and PUTs it to /api/content. Nothing is
   permanent until you press save, so a delete you regret is undone by
   reloading the page without saving.
   ==========================================================================*/

const $ = (sel, root = document) => root.querySelector(sel);

/* Kept in step with ALLOWED in api/upload.js. "image/*" and "audio/*" let the
   picker offer files the server then rejects, which reads as a broken upload.
   HEIC is deliberately absent: the server accepts it but no browser can draw
   it in an <img>, so it uploads fine and then shows "nothing yet". */
const IMAGE_TYPES = "image/jpeg,image/png,image/webp,image/gif,image/avif";
const AUDIO_TYPES = "audio/mpeg,audio/mp4,audio/aac,audio/ogg,audio/wav,audio/flac";

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

let draft = null;
let dirty = false;
let readOnly = false;      /* the saved letter couldn't be read — never save over it */

/* --- chrome --------------------------------------------------------------*/

const statusEl = () => $("#status");

function status(msg, bad = false) {
  const s = statusEl();
  if (!s) return;
  s.textContent = msg;
  s.classList.toggle("is-bad", bad);
}

function markDirty() {
  dirty = true;
  status("unsaved changes");
}

window.addEventListener("beforeunload", (e) => {
  if (!dirty) return;
  e.preventDefault();
  e.returnValue = "";
});

/* --- field builders ------------------------------------------------------*/

function field(label, obj, key, opts = {}) {
  const { multiline = 0, placeholder = "", hint = "", type = "text" } = opts;

  const wrap = el("label", "field");
  wrap.append(el("span", "field__label", label));

  const input = multiline ? el("textarea", "field__input") : el("input", "field__input");
  if (multiline) input.rows = multiline === true ? 3 : multiline;
  else input.type = type;

  input.value = obj[key] ?? "";
  input.placeholder = placeholder;
  input.addEventListener("input", () => {
    /* trimmed, so a stray space can't fail a server-side format check */
    obj[key] = type === "text" && !multiline ? input.value.trim() : input.value;
    markDirty();
  });

  wrap.append(input);
  if (hint) wrap.append(el("span", "field__hint", hint));
  return wrap;
}

/** An array of strings, edited as text. `sep` decides what separates entries. */
function listField(label, obj, key, opts = {}) {
  const { rows = 6, sep = "\n\n", hint = "" } = opts;

  const wrap = el("label", "field");
  wrap.append(el("span", "field__label", label));

  const ta = el("textarea", "field__input");
  ta.rows = rows;
  ta.value = (obj[key] || []).join(sep);

  ta.addEventListener("input", () => {
    const parts = sep === "\n" ? ta.value.split("\n") : ta.value.split(/\n\s*\n/);
    obj[key] = parts.map((s) => s.trim()).filter(Boolean);
    markDirty();
  });

  wrap.append(ta);
  wrap.append(el("span", "field__hint",
    hint || (sep === "\n" ? "one per line" : "one paragraph per block, separated by a blank line")));
  return wrap;
}

/* --- uploads -------------------------------------------------------------
   The browser sends files straight to Blob; /api/upload only issues a token.
   The client library is fetched on first use, so a slow or blocked CDN can't
   stop the editor loading — and the URL box below always works by hand.
   -----------------------------------------------------------------------*/

let uploadFn = null;

async function getUpload() {
  if (!uploadFn) {
    const mod = await import("https://esm.sh/@vercel/blob@2.8.0/client");
    uploadFn = mod.upload;
  }
  return uploadFn;
}

async function uploadFile(file) {
  const upload = await getUpload();
  const result = await upload(file.name, file, {
    access: "public",
    handleUploadUrl: "/api/upload",
    contentType: file.type || undefined,
  });
  return result.url;
}

function fileField(label, obj, key, accept = IMAGE_TYPES) {
  /* A <label> wrapping the controls, like field() and listField() do. As a div
     with a bare span the picker and the URL box had no accessible name at all,
     and there are around thirty of them across the photo lists. */
  const wrap = el("label", "field filefield");
  wrap.append(el("span", "field__label", label));

  /* An <img> preview would always fail for a song and report "nothing yet"
     even after a successful upload, so audio gets a real player instead. */
  const isAudio = accept.startsWith("audio");

  const row = el("div", "filefield__row" + (isAudio ? " filefield__row--audio" : ""));
  const thumb = el("div", "filefield__thumb" + (isAudio ? " filefield__thumb--audio" : ""));

  let media;
  if (isAudio) {
    media = el("audio");
    media.controls = true;
    media.preload = "none";
  } else {
    media = el("img");
    media.alt = "";
    media.addEventListener("error", () => thumb.classList.add("is-empty"));
  }

  thumb.append(media, el("span", "filefield__empty", isAudio ? "no music yet" : "nothing yet"));

  const side = el("div", "filefield__side");

  const picker = el("input", "filefield__file");
  picker.type = "file";
  picker.accept = accept;

  const url = el("input", "field__input");
  url.type = "text";
  url.placeholder = "images/01.jpg, or a URL";
  url.setAttribute("aria-label", `${label} — address`);

  const paint = () => {
    const src = obj[key] || "";
    url.value = src;
    thumb.classList.toggle("is-empty", !src);
    if (src) media.src = src;
  };

  url.addEventListener("input", () => { obj[key] = url.value; paint(); markDirty(); });

  picker.addEventListener("change", async () => {
    const file = picker.files && picker.files[0];
    if (!file) return;
    status(`uploading ${file.name}…`);
    try {
      obj[key] = await uploadFile(file);
      paint();
      markDirty();
      status("uploaded — remember to save");
    } catch (err) {
      console.error(err);
      status(/not signed in/i.test(err.message)
        ? "signed out — reload and sign in again"
        : "upload failed: " + err.message + " — you can paste a URL instead", true);
    } finally {
      picker.value = "";
    }
  });

  paint();
  side.append(picker, url);
  row.append(thumb, side);
  wrap.append(row);
  return wrap;
}

/* --- repeatable lists ----------------------------------------------------*/

function repeater(list, { addLabel, render, blank, itemLabel }) {
  const box = el("div", "repeat");
  const items = el("div", "repeat__items");

  const tool = (glyph, aria, fn, disabled) => {
    const b = el("button", "iconbtn", glyph);
    b.type = "button";
    b.title = aria;
    b.setAttribute("aria-label", aria);
    b.disabled = Boolean(disabled);
    b.addEventListener("click", fn);
    return b;
  };

  const draw = () => {
    /* ponytail: rebuilds the whole list, so reordering loses focus and any
       text selection in it. Moving nodes instead means the render closures
       stop capturing a stale index — worth it only if reordering gets used
       enough to be annoying. */
    items.replaceChildren();

    list.forEach((item, i) => {
      const card = el("div", "repeat__item");
      const head = el("div", "repeat__head");
      const heading = el("span", "repeat__n", itemLabel(item, i));
      head.append(heading);

      /* one listener for the whole card, rather than a hook on every builder */
      card.addEventListener("input", () => { heading.textContent = itemLabel(item, i); });

      const tools = el("div", "repeat__tools");
      tools.append(
        tool("↑", "move up", () => {
          [list[i - 1], list[i]] = [list[i], list[i - 1]];
          markDirty(); draw();
        }, i === 0),
        tool("↓", "move down", () => {
          [list[i + 1], list[i]] = [list[i], list[i + 1]];
          markDirty(); draw();
        }, i === list.length - 1),
        tool("✕", "remove", () => {
          list.splice(i, 1);
          markDirty(); draw();
        })
      );

      head.append(tools);
      card.append(head, render(item, i));
      items.append(card);
    });

    if (!list.length) {
      items.append(el("p", "hint", "nothing here yet"));
    }
  };

  const add = el("button", "btn btn--add", addLabel);
  add.type = "button";
  add.addEventListener("click", () => { list.push(blank()); markDirty(); draw(); });

  draw();
  box.append(items, add);
  return box;
}

const group = (children) => {
  const g = el("div", "group");
  children.forEach((c) => c && g.append(c));
  return g;
};

function section(title, children) {
  const s = el("section", "section");
  s.append(el("h2", "section__title", title));
  children.forEach((c) => c && s.append(c));
  return s;
}

function photos(list) {
  return repeater(list, {
    addLabel: "add a photo",
    itemLabel: (p, i) => p.caption || `photo ${i + 1}`,
    blank: () => ({ src: "", alt: "", caption: "", back: "" }),
    render: (p) => group([
      fileField("the photograph", p, "src"),
      field("caption, in the second hand", p, "caption"),
      field("written on the back", p, "back", {
        multiline: 2,
        hint: "leave this empty and the print won't flip over",
      }),
      field("description for screen readers", p, "alt"),
    ]),
  });
}

/* --- the editor ----------------------------------------------------------*/

function buildEditor() {
  const root = $("#editor");
  root.replaceChildren();

  root.append(el("p", "hint",
    "Nothing is permanent until you press save — reload without saving to undo anything."));

  root.append(section("names & dates", [
    field("your name", draft.names, "one"),
    field("their name", draft.names, "two"),
    field("the date it started", draft, "startDate", {
      /* a native date picker only ever produces YYYY-MM-DD, so the server's
         format check stops being something anyone can fail */
      type: "date",
      hint: "drives the day count and the anniversary countdown",
    }),
    field("what you call that day", draft, "startLabel"),
  ]));

  root.append(section("the envelope", [
    field("addressed to", draft.envelope, "to"),
    listField("typewritten lines", draft.envelope, "lines", { rows: 3, sep: "\n" }),
    field("postmark ring", draft.envelope.postmark, "place"),
    field("postmark date", draft.envelope.postmark, "date"),
    field("the hint underneath", draft.envelope, "hint"),
  ]));

  root.append(section("the opening", [
    field("the big line", draft.opening, "line", {
      multiline: 4, hint: "line breaks are kept exactly as you type them",
    }),
    field("caption", draft.opening, "caption"),
  ]));

  root.append(section("chapters", [
    repeater(draft.chapters, {
      addLabel: "add a chapter",
      itemLabel: (ch, i) => ch.title || `chapter ${i + 1}`,
      blank: () => ({ date: "", title: "", body: [], note: "", photos: [] }),
      render: (ch) => group([
        field("date", ch, "date"),
        field("title", ch, "title"),
        listField("the prose", ch, "body", { rows: 6 }),
        field("their note in the margin", ch, "note"),
        el("h3", "field__label", "photographs"),
        photos(ch.photos),
      ]),
    }),
  ]));

  root.append(section("the shoebox", [
    field("heading", draft.shoebox, "heading"),
    field("note", draft.shoebox, "note"),
    photos(draft.shoebox.photos),
  ]));

  root.append(section("the letter", [
    field("eyebrow", draft.letter, "heading"),
    field("salutation", draft.letter, "salutation"),
    listField("the letter itself", draft.letter, "paragraphs", { rows: 14 }),
    field("sign-off", draft.letter, "signoff"),
    field("signature", draft.letter, "signature"),
  ]));

  root.append(section("their reply", [
    // sending is configured with EMAILJS_* environment variables, not here
    field("prompt", draft.reply, "prompt"),
    field("placeholder", draft.reply, "placeholder"),
    field("send button", draft.reply, "send"),
    field("copy button", draft.reply, "button"),
  ]));

  root.append(section("the closing", [
    field("the last line", draft.closing, "line", { multiline: 3 }),
    field("note", draft.closing, "note"),
    field("under the sealed envelope", draft.closing, "sealed"),
  ]));

  root.append(section("music", [
    fileField("the audio file", draft.music, "src", AUDIO_TYPES),
    field("what to call it", draft.music, "title"),
  ]));
}

/* --- loading and saving --------------------------------------------------*/

/** Fill in anything a saved older version might be missing. */
function withDefaults(data) {
  const seed = window.CONTENT_SEED || {};
  const out = { ...seed, ...data };
  out.names = { ...(seed.names || {}), ...(data.names || {}) };
  out.envelope = { ...(seed.envelope || {}), ...(data.envelope || {}) };
  out.envelope.postmark = {
    ...((seed.envelope || {}).postmark || {}),
    ...((data.envelope || {}).postmark || {}),
  };
  out.opening = { ...(seed.opening || {}), ...(data.opening || {}) };
  out.shoebox = { ...(seed.shoebox || {}), ...(data.shoebox || {}) };
  out.letter = { ...(seed.letter || {}), ...(data.letter || {}) };
  out.reply = { ...(seed.reply || {}), ...(data.reply || {}) };
  out.closing = { ...(seed.closing || {}), ...(data.closing || {}) };
  out.music = { ...(seed.music || {}), ...(data.music || {}) };
  out.chapters = Array.isArray(out.chapters) ? out.chapters : [];
  out.shoebox.photos = Array.isArray(out.shoebox.photos) ? out.shoebox.photos : [];
  out.chapters.forEach((ch) => { if (!Array.isArray(ch.photos)) ch.photos = []; });

  /* listField calls .join() on these three, so anything that isn't an array
     throws while the editor is being built — see start(). */
  if (!Array.isArray(out.letter.paragraphs)) out.letter.paragraphs = [];
  if (!Array.isArray(out.envelope.lines)) out.envelope.lines = [];
  out.chapters.forEach((ch) => { if (!Array.isArray(ch.body)) ch.body = []; });
  return out;
}

/* The editor must never present the starter template as if it were the saved
   letter. If it does, the obvious move — edit a field, press save — writes the
   template over a real story, and there is no version history to get it back.
   So this returns WHY it is showing what it is showing, and save() refuses
   when the answer is "I couldn't read it". */
async function loadDraft() {
  let res;
  try {
    res = await fetch("/api/content", { cache: "no-store" });
  } catch (err) {
    console.error("could not reach /api/content:", err.message);
    return { draft: null, source: "unavailable" };
  }

  if (res.status === 204) {
    return { draft: withDefaults(structuredClone(window.CONTENT_SEED || {})), source: "seed" };
  }

  if (res.ok) {
    try {
      return { draft: withDefaults(await res.json()), source: "saved" };
    } catch (err) {
      console.error("the saved letter isn't readable JSON:", err.message);
      return { draft: null, source: "unavailable" };
    }
  }

  console.error("/api/content answered", res.status);
  return { draft: null, source: "unavailable" };
}

async function save() {
  if (readOnly) {
    status("not saving — the letter here couldn't be read, so this would overwrite it", true);
    return;
  }

  const btn = $("#save");
  btn.disabled = true;                    /* two clicks were two concurrent PUTs */
  status("saving…");
  try {
    const res = await fetch("/api/content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const data = await res.json().catch(() => ({}));

    if (res.status === 401) throw new Error("signed out — reload and sign in again");
    if (!res.ok) throw new Error(data.error || "HTTP " + res.status);

    dirty = false;
    status("saved");
  } catch (err) {
    status("could not save: " + err.message, true);
  } finally {
    btn.disabled = readOnly;
  }
}

/* --- the gate ------------------------------------------------------------*/

async function alreadyIn() {
  try {
    const res = await fetch("/api/login", { cache: "no-store" });
    const data = await res.json();
    return Boolean(data.authed);
  } catch {
    return false;
  }
}

async function start() {
  /* Build BEFORE swapping visibility. The other order hides the gate first,
     so anything thrown in here lands in #gateError inside a display:none
     element — a blank editor and no visible reason for it. */
  const { draft: loaded, source } = await loadDraft();

  readOnly = source === "unavailable";
  draft = loaded || withDefaults(structuredClone(window.CONTENT_SEED || {}));
  buildEditor();

  $("#gate").hidden = true;
  $("#app").hidden = false;
  $("#editor").focus();                   /* focus was falling to <body> */

  dirty = false;
  $("#save").disabled = readOnly;

  if (readOnly) {
    status("couldn't read the saved letter — showing the template, saving is off", true);
  } else if (source === "seed") {
    status("the starter template — nothing saved yet");
  } else {
    status("your letter");
  }

  $("#save").addEventListener("click", save);

  $("#signOut").addEventListener("click", async () => {
    /* This used to set dirty = false and reload, which deliberately disarmed
       the beforeunload guard — one mis-click threw away an evening's edits. */
    if (dirty && !confirm("You have unsaved changes. Sign out and lose them?")) return;

    try {
      await fetch("/api/login", { method: "DELETE" });
    } catch (err) {
      /* the cookie is still valid; saying so beats a button that does nothing */
      status("couldn't sign out: " + err.message, true);
      return;
    }
    dirty = false;
    location.reload();
  });
}

$("#gateForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("#gateBtn");
  const err = $("#gateError");
  err.textContent = "";
  btn.disabled = true;

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: $("#password").value }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "could not sign in");
    await start();
  } catch (e2) {
    err.textContent = e2.message;
  } finally {
    btn.disabled = false;
  }
});

/* The gate is what's on screen until this resolves, so a failure in start()
   has to land there — otherwise it's an unhandled rejection and a password
   form that silently refuses to go away. */
alreadyIn().then((yes) => {
  if (!yes) return;
  return start().catch((err) => {
    console.error(err);
    $("#gateError").textContent = "couldn't open the editor: " + err.message;
  });
});
