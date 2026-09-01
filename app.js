/* ============================================================================
   IN TWO HANDS — behaviour

   The story is loaded from /api/content at startup and falls back to the seed
   in content.js if that isn't reachable. Edit the story at /admin, not here.
   ==========================================================================*/

/** The live story. Populated before anything renders. */
let CONTENT = null;

/**
 * The saved story, or the bundled seed. A 204 means nothing has been saved
 * yet; any failure at all means the letter still renders from the seed rather
 * than showing nothing.
 */
async function loadContent() {
  try {
    const res = await fetch("/api/content", { cache: "no-store" });
    if (res.ok && res.status !== 204) {
      const data = await res.json();
      if (data && data.names && Array.isArray(data.chapters)) return data;
    }
  } catch (err) {
    console.warn("[in-two-hands] using the bundled story:", err.message);
  }
  return window.CONTENT_SEED;
}

/* --- time ------------------------------------------------------------------
   The only real logic in the page, so it's pure and self-tested.
   Open  index.html?selftest  and check the console.
   -------------------------------------------------------------------------*/

/** "YYYY-MM-DD" → local midnight (never UTC — `new Date(iso)` would be UTC). */
function parseLocalDate(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Whole calendar days from a to b. Rounds, so a DST hour can't shift a day. */
function daysBetween(a, b) {
  const A = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const B = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((B - A) / 86400000);
}

/** Days since the start date, plus how far into today we are. */
function elapsed(startISO, now) {
  return {
    days: daysBetween(parseLocalDate(startISO), now),
    hours: now.getHours(),
    minutes: now.getMinutes(),
    seconds: now.getSeconds(),
  };
}

/** The next occurrence of the start date's month/day, and which one it'll be. */
function nextAnniversary(startISO, now) {
  const start = parseLocalDate(startISO);
  const at = (y) => new Date(y, start.getMonth(), start.getDate());
  let date = at(now.getFullYear());
  if (daysBetween(now, date) < 0) date = at(now.getFullYear() + 1);
  return { date, days: daysBetween(now, date), years: date.getFullYear() - start.getFullYear() };
}

function ordinal(n) {
  const t = n % 100;
  if (t >= 11 && t <= 13) return n + "th";
  return n + ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th");
}

const pad = (n) => String(n).padStart(2, "0");

/** Whether the send button should be disabled. Pure, so it can be tested. */
function sendDisabled({ sending, value, lastSent }) {
  return Boolean(sending) || !String(value).trim() || value === lastSent;
}

function selftest() {
  const ok = (cond, what) => {
    if (!cond) { console.error("FAIL — " + what); throw new Error(what); }
    console.log("ok — " + what);
  };
  const D = (y, m, d, h = 12) => new Date(y, m - 1, d, h);

  ok(daysBetween(D(2024, 3, 1), D(2024, 3, 31)) === 30, "daysBetween survives a DST change");
  ok(daysBetween(D(2019, 11, 8), D(2019, 11, 8, 23)) === 0, "same calendar day is 0 days");
  ok(elapsed("2019-11-08", D(2019, 11, 9)).days === 1, "one day elapsed");
  ok(elapsed("2019-11-08", D(2026, 8, 31)).days === 2488, "2488 days from 08.11.2019 to 31.08.2026");

  const soon = nextAnniversary("2019-11-08", D(2026, 8, 31));
  ok(soon.days === 69 && soon.years === 7, "next anniversary is the 7th, 69 days out");

  const onTheDay = nextAnniversary("2019-11-08", D(2026, 11, 8));
  ok(onTheDay.days === 0 && onTheDay.years === 7, "on the day itself it counts 0, not a year out");

  const past = nextAnniversary("2019-11-08", D(2026, 12, 1));
  ok(past.years === 8 && past.date.getFullYear() === 2027, "after the date it rolls to next year");

  ok(ordinal(1) === "1st" && ordinal(11) === "11th" && ordinal(22) === "22nd", "ordinals");

  ok(sendDisabled({ sending: false, value: "", lastSent: null }), "an empty reply can't be sent");
  ok(sendDisabled({ sending: false, value: "   ", lastSent: null }), "whitespace alone can't be sent");
  ok(sendDisabled({ sending: true, value: "hi", lastSent: null }), "no second send while one is in flight");
  ok(sendDisabled({ sending: false, value: "hi", lastSent: "hi" }), "the same words can't be sent twice");
  ok(!sendDisabled({ sending: false, value: "hi again", lastSent: "hi" }), "an edited reply can be sent again");
  console.log("%cselftest passed", "color:#A2637A");
}

/* --- tiny DOM helpers ----------------------------------------------------*/

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

/* Photos sit at a slight angle. Derived from the index, never Math.random(),
   so the page looks the same on every reload. */
const TILTS = [-1.8, 1.5, -1.1, 2.0, -2.2, 1.2];
const tiltFor = (i) => TILTS[i % TILTS.length] + "deg";

/**
 * A photograph held to the page by paper corners. If the file isn't in
 * images/ yet it renders as an empty mount labelled with the name it wants.
 */
function buildPhoto(photo, index) {
  const fig = el("figure", "photo");
  fig.style.setProperty("--tilt", tiltFor(index));

  const flip = el("div", "photo__flip");
  const front = el("div", "photo__face photo__face--front");

  front.append(el("span", "photo__corner photo__corner--tl"));
  front.append(el("span", "photo__corner photo__corner--br"));

  const img = el("img", "photo__img");
  img.alt = photo.alt || "";
  img.loading = "lazy";
  img.addEventListener("error", () => fig.classList.add("is-empty"), { once: true });
  front.append(img);

  front.append(el("span", "photo__mount type", `photograph\n${photo.src || "no file set"}`));
  flip.append(front);

  /* only prints with something written on the reverse can be turned over */
  if (photo.back) {
    fig.classList.add("photo--flippable");
    front.append(el("span", "photo__turn type", "turn over"));

    const back = el("div", "photo__face photo__face--back");
    back.append(el("p", "photo__back-text hand-b", photo.back));
    back.append(el("span", "photo__turn type", "turn back"));
    flip.append(back);

    flip.setAttribute("role", "button");
    flip.setAttribute("aria-pressed", "false");
    flip.setAttribute("aria-label", `Turn over: ${photo.caption || photo.alt || "photograph"}`);
    flip.tabIndex = 0;
  }

  fig.append(flip);
  if (photo.caption) fig.append(el("figcaption", "photo__cap hand-b", photo.caption));

  if (photo.src) img.src = photo.src;
  else fig.classList.add("is-empty");

  return fig;
}

/**
 * Turning a print over is an interaction, not an animation — it is wired up
 * with the rest of the content so it still works if GSAP never loads.
 * One delegated listener covers every print, including the shoebox.
 */
function setupFlips() {
  const turn = (flip) => {
    const showing = flip.classList.toggle("is-flipped");
    flip.setAttribute("aria-pressed", String(showing));
  };

  document.addEventListener("click", (e) => {
    const flip = e.target.closest?.(".photo--flippable .photo__flip");
    if (flip) turn(flip);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const flip = e.target.closest?.(".photo--flippable .photo__flip");
    if (!flip) return;
    e.preventDefault();
    turn(flip);
  });
}

/**
 * The envelope. Built twice from the same description: once as the cover,
 * once at the end where it seals itself again.
 */
function buildEnvelope(mount, env) {
  mount.replaceChildren();
  mount.append(el("span", "envelope__letter"));

  const front = el("div", "envelope__front");
  front.append(el("span", "envelope__to type", "to"));
  front.append(el("span", "envelope__name hand-a", env.to));

  const lines = el("span", "envelope__lines type");
  (env.lines || []).forEach((line) => lines.append(el("span", null, line)));
  front.append(lines);

  const mark = env.postmark || {};
  const pm = el("span", "postmark");
  pm.append(el("span", "postmark__bars"));
  pm.append(el("span", "postmark__place type", mark.place || ""));
  pm.append(el("span", "postmark__date type", mark.date || ""));
  front.append(pm);

  mount.append(front);
  mount.append(el("span", "envelope__flap"));
  return mount;
}

/* Where her reply lives. Her browser only — nothing is sent from this page. */
const REPLY_KEY = "in-two-hands:reply";

/**
 * Her turn. Typing has to work with GSAP absent, so this is set up with the
 * content and not with the motion.
 */
function setupReply() {
  const R = CONTENT.reply;
  const field = $("#replyField");
  if (!R || !field) { $("#reply")?.remove(); return; }

  $("#replyPrompt").textContent = R.prompt || "";
  $("#replyLabel").textContent = R.prompt || "your reply";
  field.placeholder = R.placeholder || "";

  const sendBtn = $("#replySend");
  const copyBtn = $("#replyCopy");
  const saved = $("#replySaved");

  /* Storage throws outright in some private modes. It must never stop her
     typing, and it must never take the page down. */
  const read = () => { try { return localStorage.getItem(REPLY_KEY) || ""; } catch { return ""; } };
  const write = (v) => { try { localStorage.setItem(REPLY_KEY, v); return true; } catch { return false; } };

  let timer;
  const note = (msg) => {
    if (!msg) return;
    saved.textContent = msg;
    saved.classList.add("is-shown");
    clearTimeout(timer);
    timer = setTimeout(() => saved.classList.remove("is-shown"), 2600);
  };

  const revealCopy = (msg) => {
    copyBtn.hidden = false;
    copyBtn.textContent = R.button || "copy";
    note(msg);
  };

  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(field.value);
      note("copied");
    } catch {
      field.select();
      note("select it and copy");
    }
  });

  field.value = read();

  let sending = false;
  let lastSent = null;
  let canSend = false;

  const refresh = () => {
    sendBtn.disabled = !canSend || sendDisabled({ sending, value: field.value, lastSent });
  };

  field.addEventListener("input", () => {
    if (write(field.value)) note(R.saved);
    if (!sending && field.value !== lastSent) sendBtn.textContent = R.send || "send it";
    refresh();
  });

  /* Copy is the safe default. Sending only appears once the server confirms
     it has the mail credentials — so a deployment without them, or a page
     opened as a local file, never shows a button that can't work. */
  sendBtn.hidden = true;
  revealCopy("");

  fetch("/api/reply", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { configured: false }))
    .then((data) => {
      if (!data.configured) return;
      canSend = true;
      sendBtn.hidden = false;
      copyBtn.hidden = true;                  /* it comes back if a send fails */
      sendBtn.textContent = R.send || "send it";
      refresh();
    })
    .catch(() => {
      if (location.protocol === "file:") note(R.needsHosting);
    });

  sendBtn.addEventListener("click", async () => {
    if (sending || !field.value.trim()) return;      /* not just the attribute */

    sending = true;
    sendBtn.textContent = R.sending || "sending...";
    refresh();

    const text = field.value;

    try {
      const res = await fetch("/api/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "HTTP " + res.status);

      lastSent = text;
      sendBtn.textContent = R.sent || "sent";
      note(R.sent || "sent");
    } catch (err) {
      console.error("[in-two-hands] the reply couldn't be sent:", err);
      sendBtn.textContent = R.send || "send it";     /* she can try again */
      revealCopy(R.failed || "couldn't send - copy it instead");
    } finally {
      sending = false;
      refresh();
    }
  });
}

/* Bengali is a connected script: the letter-spacing and uppercasing that suit
   the typewritten Latin labels pull its conjuncts apart. Flag any element that
   actually contains Bengali so the stylesheet can leave it alone. Latin-only
   pages are untouched. */
const BENGALI = /[\u0980-\u09FF]/;

function markBengali(root = document) {
  $$(".type, .hand-a, .hand-b", root).forEach((n) => {
    if (BENGALI.test(n.textContent)) n.classList.add("has-bengali");
  });
}

/* --- build the page from CONTENT -----------------------------------------*/

function render() {
  const C = CONTENT;
  const both = `${C.names.one} & ${C.names.two}`;
  document.title = `${both}`;

  /* the envelope — the cover, and again at the end */
  $("#foldBtn").classList.add("is-ready");
  buildEnvelope($("#coverEnvelope"), C.envelope);
  buildEnvelope($("#closeEnvelope"), C.envelope);
  $("#foldHint").textContent = C.envelope.hint;

  /* opening */
  $("#openNames").textContent = both;
  $("#openLine").textContent = C.opening.line;
  $("#openCaption").textContent = C.opening.caption;

  /* chapters — each one is a knot on the thread */
  const wrap = $("#chapters");
  C.chapters.forEach((ch) => {
    const knot = el("div", "knot");
    knot.append(el("span", "knot__date type", ch.date));
    wrap.append(knot);

    const sec = el("section", "chapter");
    sec.append(el("h2", "chapter__title hand-a", ch.title));

    const body = el("div", "chapter__body");
    (ch.body || []).forEach((p) => body.append(el("p", null, p)));
    sec.append(body);

    if (ch.photos && ch.photos.length) {
      const box = el("div", "chapter__photos");
      box.dataset.count = String(ch.photos.length);
      ch.photos.forEach((p, i) => box.append(buildPhoto(p, i)));
      sec.append(box);
    }

    if (ch.note) sec.append(el("p", "chapter__note hand-b", ch.note));

    wrap.append(sec);
  });

  /* the shoebox — the loose pile */
  const box = C.shoebox;
  if (box && box.photos && box.photos.length) {
    $("#shoeboxHeading").textContent = box.heading;
    $("#shoeboxNote").textContent = box.note;
    const pile = $("#shoeboxPile");
    box.photos.forEach((ph, i) => pile.append(buildPhoto(ph, i)));
  } else {
    $("#shoebox").remove();
  }

  /* the letter */
  $("#letterHeading").textContent = C.letter.heading;
  $("#letterSalutation").textContent = C.letter.salutation;
  const lb = $("#letterBody");
  C.letter.paragraphs.forEach((p) => lb.append(el("p", null, p)));
  $("#letterSignoff").textContent = C.letter.signoff;
  $("#letterSignature").textContent = C.letter.signature;

  /* closing */
  $("#closeLine").textContent = C.closing.line;
  $("#closeNote").textContent = C.closing.note;
  $("#closeSealed").textContent = C.closing.sealed || "";

  markBengali();
}

/* --- the counters --------------------------------------------------------*/

function startCounters() {
  const days = $("#countDays");
  const countdown = $("#countdown");

  const paint = () => {
    const now = new Date();
    days.textContent = elapsed(CONTENT.startDate, now).days.toLocaleString();

    const next = nextAnniversary(CONTENT.startDate, now);
    countdown.textContent = next.days === 0
      ? `${ordinal(next.years)} anniversary — today`
      : `${next.days} ${next.days === 1 ? "day" : "days"} to the ${ordinal(next.years)}`;
  };

  paint();
  setInterval(paint, 60000);   // it counts in days; once a minute is plenty
}

/* --- music ---------------------------------------------------------------*/

function setupMusic() {
  const src = CONTENT.music && CONTENT.music.src;
  if (!src) return;

  const btn = $("#musicBtn");
  const audio = $("#audio");
  audio.src = src;
  $("#musicLabel").textContent = CONTENT.music.title || "music";
  btn.hidden = false;

  btn.addEventListener("click", () => {
    if (audio.paused) {
      audio.play().then(
        () => btn.setAttribute("aria-pressed", "true"),
        () => { $("#musicLabel").textContent = "no audio file"; }
      );
    } else {
      audio.pause();
      btn.setAttribute("aria-pressed", "false");
    }
  });
}

/* --- motion --------------------------------------------------------------*/

const HAS_GSAP = typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined";
const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const ANIMATE = HAS_GSAP && !REDUCED;

/** Wrap every word of an element in its own span so it can be inked in turn. */
function splitWords(node) {
  const words = [];
  const parts = node.textContent.split(/(\s+)/);
  node.textContent = "";
  parts.forEach((part) => {
    if (!part) return;
    if (/^\s+$/.test(part)) { node.append(part); return; }
    const span = el("span", "w", part);
    node.append(span);
    words.push(span);
  });
  return words;
}

/** Every word of the letter, in the order it gets written. */
function letterWords() {
  const nodes = [$("#letterSalutation"), ...$$("#letterBody p"), $("#letterSignoff"), $("#letterSignature")];
  return nodes.flatMap(splitWords);
}

/** Give an SVG path a dash pattern so it can draw itself. */
function prepareStroke(path) {
  const len = path.getTotalLength();
  gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
  return len;
}

/** Stable pseudo-random in 0..1 from an integer. Never Math.random() — the
    pile has to look identical on every reload. */
function hash01(n) {
  const v = Math.sin(n * 12.9898) * 43758.5453;
  return v - Math.floor(v);
}

/** Where print `i` of `n` ends up, as a percentage offset from the centre. */
function scatterAt(i, n) {
  const across = n > 1 ? i / (n - 1) : .5;          /* 0..1 left to right */
  const jx = hash01(i + 1);
  const jy = hash01(i + 7.3);
  return {
    x: (across - .5) * 84 + (jx - .5) * 14,         /* % of pile width  */
    y: (jy - .5) * 58,                              /* % of pile height */
    r: (jx - .5) * 46,                              /* degrees          */
  };
}

/**
 * The loose pile: stacked at the centre, fanning out across the page as the
 * section is scrolled through. Pinned, which is safe here because the stage
 * is viewport-height by design — unlike the letter, nothing can be cropped.
 */
function setupShoebox() {
  const pile = $("#shoeboxPile");
  if (!pile) return;                        /* no shoebox in content.js */

  const prints = $$(".photo", pile);
  if (!prints.length) return;

  const n = prints.length;
  const mm = gsap.matchMedia();

  mm.add("(min-width: 900px)", () => {
    gsap.set(prints, { xPercent: -50, yPercent: -50, zIndex: (i) => i });

    gsap.fromTo(prints,
      { x: 0, y: 0, rotation: (i) => (i % 2 ? 5 : -5), scale: .9 },
      {
        x: (i) => scatterAt(i, n).x * pile.clientWidth / 100,
        y: (i) => scatterAt(i, n).y * pile.clientHeight / 100,
        rotation: (i) => scatterAt(i, n).r,
        scale: 1,
        ease: "power2.out",
        stagger: { each: .035, from: "center" },
        scrollTrigger: {
          trigger: "#shoebox",
          start: "top top",
          end: () => "+=" + Math.round(window.innerHeight * 1.25),
          pin: true,
          scrub: .7,
          invalidateOnRefresh: true,
        },
      });
  });

  /* The fan needs width to read, so a phone gets the pile as a grid instead.
     Each print has its own trigger rather than one for the whole pile — with
     twelve of them stacked vertically, a single trigger would fire the lot
     while most were still far below the fold. */
  mm.add("(max-width: 899px)", () => {
    prints.forEach((print) => {
      gsap.from(print, {
        y: 22, opacity: 0, duration: .6, ease: "power2.out",
        scrollTrigger: { trigger: print, start: "top 92%", once: true },
      });
    });
  });
}

/**
 * The ending: the letter folds into thirds, drops into the envelope, the flap
 * closes and the thread ties. Scrubbed against the section's own travel —
 * deliberately NOT pinned, because a pinned section taller than the viewport
 * gets cropped, which has bitten this page twice already.
 */
function setupKeeping() {
  const keep = $("#keep");
  if (!keep) return;

  const sheet  = $(".keep__sheet", keep);
  const top    = $(".keep__third--top", keep);
  const bottom = $(".keep__third--bottom", keep);
  const flap   = $(".envelope__flap", keep);
  const bow    = $("#bowPath");

  prepareStroke(bow);                      /* same draw as the flourish */
  gsap.set(sheet, { opacity: 1 });          /* CSS hides it; at rest it's kept */

  gsap.timeline({
    scrollTrigger: { trigger: keep, start: "top 82%", end: "bottom 45%", scrub: .7 },
  })
    .set(flap, { rotationX: -168 })                                   /* open */
    .to(top,    { rotationX: 180,  duration: 1, ease: "power2.inOut" })
    .to(bottom, { rotationX: -180, duration: 1, ease: "power2.inOut" }, "<")
    .to(sheet,  { yPercent: 74, scale: .8, duration: 1.2, ease: "power2.in" })
    .to(sheet,  { opacity: 0, duration: .3 }, "-=.3")
    .to(flap,   { rotationX: 0, duration: .9, ease: "power2.inOut" }, "-=.15")
    .to(bow,    { strokeDashoffset: 0, duration: 1.1, ease: "power1.inOut" });
}

function setupMotion() {
  gsap.registerPlugin(ScrollTrigger);

  const words = letterWords();
  const sheet = $("#letterSheet");
  const nib = $("#nib");
  const flourish = $("#flourishPath");

  /* --- the thread stitches itself down the margin ----------------------- */
  gsap.to("#stitchRect", {
    attr: { height: 1000 },
    ease: "none",
    scrollTrigger: { trigger: "#chapters", start: "top 65%", end: "bottom bottom", scrub: .6 },
  });

  /* --- chapters arrive -------------------------------------------------- */
  $$(".chapter").forEach((ch) => {
    const knot = ch.previousElementSibling;
    const title = $(".chapter__title", ch);
    /* the same word-by-word inking the letter uses, so the chapters and the
       letter feel written by the same hand */
    const titleWords = splitWords(title);
    const rest = Array.from(ch.children).filter((n) => n !== title);

    gsap.timeline({ scrollTrigger: { trigger: ch, start: "top 80%", once: true } })
      .from(knot, { opacity: 0, x: -10, duration: .7, ease: "power2.out" })
      .fromTo(titleWords,
        { opacity: 0, filter: "blur(4px)" },
        { opacity: 1, filter: "blur(0px)", duration: .3, stagger: .07, ease: "none" }, "-=.45")
      .from(rest, { y: 26, opacity: 0, duration: .9, stagger: .12, ease: "power3.out" }, "-=.35");
  });

  /* --- the postmark lands on the cover, before she clicks anything ------ */
  const stamp = $("#coverEnvelope .postmark");
  if (stamp) {
    gsap.from(stamp, {
      scale: 2.1, opacity: 0, rotation: -32, filter: "blur(5px)",
      duration: .75, ease: "back.out(2.4)", delay: .5,
    });
  }

  /* --- the shoebox fans out under the scroll ---------------------------- */
  setupShoebox();

  /* --- and at the end, it is put away ----------------------------------- */
  setupKeeping();

  /* --- the counter's rose underline draws once -------------------------- */
  const rule = $("#countRule");
  prepareStroke(rule);

  /* --- THE LETTER: written under the scroll ------------------------------
     Word offsets are cached rather than measured every frame — one read per
     resize instead of one per scroll tick.
     -------------------------------------------------------------------- */
  let offsets = [];
  const measure = () => {
    /* offsetLeft/Top are layout positions, so the sheet's slight `rotate:`
       doesn't skew them the way getBoundingClientRect would. The spans'
       offsetParent is .sheet, which is position:relative — same as the nib. */
    offsets = words.map((w) => ({ x: w.offsetLeft + w.offsetWidth, y: w.offsetTop }));
  };

  const moveNib = (progress) => {
    if (!offsets.length) return;
    const i = Math.min(offsets.length - 1, Math.floor(progress * offsets.length));
    const at = offsets[i];
    gsap.set(nib, { x: at.x + 2, y: at.y, opacity: progress > 0 && progress < 1 ? 1 : 0 });
  };

  const writeTween = (timeline) => {
    timeline.to(words, {
      opacity: 1,
      filter: "blur(0px)",
      duration: .14,
      stagger: .05,
      ease: "none",
      onUpdate() { moveNib(this.progress()); },
    });
    timeline.to(flourish, { strokeDashoffset: 0, duration: 1.4, ease: "power1.inOut" }, ">-0.2");
    return timeline;
  };

  /* The sheet is taller than the viewport once there are a few paragraphs, so
     the writing is scrubbed against the sheet's own travel rather than pinned
     — pinning would crop the bottom of the letter. Scrolling back un-writes it. */
  gsap.set(words, { opacity: 0, filter: "blur(4px)" });
  prepareStroke(flourish);
  writeTween(gsap.timeline({
    scrollTrigger: {
      trigger: sheet,
      start: "top 85%",
      end: "bottom 65%",
      scrub: .8,
      invalidateOnRefresh: true,
    },
  }));

  /* --- closing ---------------------------------------------------------- */
  gsap.from("#closing > *", {
    y: 22, opacity: 0, duration: 1, stagger: .18, ease: "power3.out",
    scrollTrigger: { trigger: "#closing", start: "top 78%", once: true },
  });

  /* handwriting metrics differ a lot from the fallback face — wait for the
     real fonts before measuring anything. */
  const settle = () => { measure(); ScrollTrigger.refresh(); };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(settle);
  else window.addEventListener("load", settle);
  window.addEventListener("resize", () => measure());

  return { rule };
}

/* --- untying the fold ----------------------------------------------------
   This is attached BEFORE any motion is set up, and never depends on it. A
   broken animation must never be able to trap someone on the cover.
   -------------------------------------------------------------------------*/

/** Set by setupMotion() if it succeeds. The fold works either way. */
let motion = null;

function setupFold() {
  const fold = $("#fold");
  const page = $("#page");
  const root = document.documentElement;
  let opened = false;

  root.classList.add("is-covered");
  root.style.overflow = "hidden";

  /* A reload has to start at the envelope, not where she left off.
     Three things conspire against that:
       - browsers restore the previous scroll position on reload;
       - a leftover #page in the URL makes the browser jump there;
       - and that same #page would trigger the no-JS :target escape, so the
         envelope would be gone before she ever saw it. */
  try { history.scrollRestoration = "manual"; } catch { /* not everywhere */ }

  if (location.hash === "#page") {
    history.replaceState(null, "", location.pathname + location.search);
  }

  const toTop = () => window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  toTop();

  const finish = () => {
    fold.remove();
    if (HAS_GSAP) ScrollTrigger.refresh();
  };

  const open = () => {
    if (opened) return;
    opened = true;

    page.classList.add("is-open");
    root.classList.remove("is-covered");
    root.style.overflow = "";
    toTop();                      /* the story always begins at the beginning */

    if (!ANIMATE) { finish(); return; }

    try {
      const tl = gsap.timeline();
      tl.to("#coverEnvelope .envelope__flap", { rotationX: -168, duration: .6, ease: "power2.inOut" })
        .to("#coverEnvelope .envelope__letter", { yPercent: -58, duration: .75, ease: "power2.out" }, "-=.25")
        .to("#foldBtn", { y: -22, opacity: 0, duration: .55, ease: "power2.in" }, "-=.2")
        .to("#fold", { opacity: 0, duration: .85, ease: "power2.inOut" }, "-=.35")
        .add(finish)
        .from("#opening > *", { y: 26, opacity: 0, duration: 1, stagger: .13, ease: "power3.out" }, "-=.55");

      if (motion) tl.to(motion.rule, { strokeDashoffset: 0, duration: 1.2, ease: "power2.out" }, "-=.7");
    } catch (err) {
      console.error("[in-two-hands] the fold animation failed, opening it plainly:", err);
      finish();
    }
  };

  /* the link, anywhere on the cover, and a key — three ways in. The link
     still works on its own if this listener never runs (see styles.css). */
  fold.addEventListener("click", (e) => { e.preventDefault(); open(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" || e.key === "Enter" || e.key === " ") open();
  });
}

/* --- go ------------------------------------------------------------------*/

/* The way out of the cover goes on first, and stays synchronous. It must not
   wait on the network — nothing below can trap anyone. */
setupFold();

loadContent().then((data) => {
  CONTENT = data;

  /* Everything here reads the story, so a malformed one shows up as a single
     console line instead of a dead page. */
  try {
    render();
    setupFlips();
    setupReply();
    startCounters();
    setupMusic();
  } catch (err) {
    console.error("[in-two-hands] the story is malformed:", err);
  }

  /* Motion is a bonus layer. If it fails the page is still a readable letter,
     so it must never take the rest of the page down with it. */
  if (ANIMATE) {
    try {
      motion = setupMotion();
    } catch (err) {
      console.error("[in-two-hands] motion setup failed; the page still works, it just won't animate:", err);
    }
  }

  if (new URLSearchParams(location.search).has("selftest")) selftest();
});
