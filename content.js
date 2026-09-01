/* ============================================================================
   IN TWO HANDS — the seed.

   THIS FILE IS THE SHARED TEMPLATE. REAL NAMES NEVER GO IN IT.

   One repo backs several deployments, so anything written here shows up on
   every new one. Personalise at /admin, which saves to that deployment's own
   storage and touches nothing else.

   YOU NO LONGER EDIT THIS FILE BY HAND — use /admin.

   This is the starting content and the safety net: the page loads the live
   version from /api/content, and falls back to what's below if that ever
   fails or if nothing has been saved yet. The first time you open /admin it
   loads this, and pressing Save copies it into Blob storage.

   Every string below is placeholder text, written to show the rhythm and
   length the layout expects. None of it is about you — replace all of it.

   Two hands are used throughout:
     · YOUR hand  (Caveat)            — titles, the letter
     · HER hand   (Cedarville Cursive) — margin notes, photo captions
   You don't choose them per string; the layout assigns them.

   Every photo can carry a `back:` line — what's written on the reverse, in
   the second hand. Click a print on the page and it turns over to show it. Leave
   `back` out and that print simply doesn't flip.

   Photos: drop files into  images/  named to match the `src` values below.
   Any photo that isn't there yet renders as an empty paper mount, which looks
   deliberate — so you can fill the page one photo at a time.

   Music: drop an .mp3 into  music/  and point `music.src` at it.
   ==========================================================================*/

window.CONTENT_SEED = {

  /* --- the two of you ---------------------------------------------------- */
  names: {
    one: "Your name",
    two: "Their name",
  },

  /* --- the date it started. YYYY-MM-DD. Drives the whole counter. -------- */
  startDate: "2019-11-08",

  /* --- what you call that day, in your words ----------------------------- */
  startLabel: "the night we met",

  /* --- THE ENVELOPE (the first thing they see, and the last) --------------
     It arrives addressed to her, a postmark lands on it, and clicking it
     lets the letter out. The same envelope seals again at the very end.
     -------------------------------------------------------------------- */
  envelope: {
    /* handwritten across the front, in your hand */
    to: "Their name",
    /* typewritten underneath, one string per line. Two or three is plenty. */
    lines: [
      "by hand",
      "not to be opened early",
    ],
    /* the postmark that thuds down on it */
    postmark: {
      place: "kept",        /* the ring of text around the stamp */
      date: "08 NOV",       /* stamped across the middle */
    },
    hint: "open it",
  },

  /* --- THE OPENING ------------------------------------------------------- */
  opening: {
    /* large, in your hand. Keep it short — it's set very big. \n breaks. */
    line: "Six years,\nand I still\nhaven't finished\nthe sentence.",
    /* typewritten, small, under the day count */
    caption: "written by hand, kept on paper",
  },

  /* --- THE CHAPTERS ------------------------------------------------------
     Each chapter is a knot on the thread running down the margin.
       date    — typewritten on the thread
       title   — in your hand
       body    — the prose. One string per paragraph.
       note    — optional. A margin note in the second hand, set at an angle.
                 Leave as "" to skip it.
       photos  — 0, 1 or 2. More than 2 in one chapter gets crowded.
     -------------------------------------------------------------------- */
  chapters: [
    {
      date: "08.11.2019",
      title: "The first page",
      body: [
        "Write what that first night actually looked like. Not the summary — the detail. What you were wearing, what was playing, the thing they said that you still repeat back to them.",
        "Two short paragraphs is right. The photograph does the rest of the work.",
      ],
      note: "i almost didn't come out that night",
      photos: [
        { src: "images/01.jpg", alt: "The night we met", caption: "the first one",
          back: "you took this without asking and i'm glad you did" },
        { src: "images/02.jpg", alt: "Later the same night", caption: "and later",
          back: "we stayed until they turned the lights on" },
      ],
    },
    {
      date: "Spring 2020",
      title: "Learning each other",
      body: [
        "This is the chapter for the year you figured each other out. The routines, the arguments about nothing, the first time it felt ordinary in the good way.",
      ],
      note: "you still make tea wrong",
      photos: [
        { src: "images/03.jpg", alt: "A morning that spring", caption: "our kitchen",
          back: "the flat with the broken window" },
        { src: "images/04.jpg", alt: "The same week, later", caption: "same week",
          back: "" },
        { src: "images/05.jpg", alt: "Out walking", caption: "the long way home",
          back: "we did this every evening for a month" },
      ],
    },
    {
      date: "Somewhere in there",
      title: "The page with no photograph",
      body: [
        "Use a chapter with no photos for something nobody thought to take a picture of. A phone call. A drive. The night you both remember perfectly anyway.",
        "Keep it short. Its whole job is to slow the page down before the next photograph.",
      ],
      note: "i remember what you said",
      photos: [],
    },
    {
      date: "2022",
      title: "The long year",
      body: [
        "The hard year, if there was one, goes here — told honestly and briefly. It makes everything after it mean more.",
        "If there wasn't one, use this for the year you travelled, or moved, or the year everything finally got easy.",
      ],
      note: "",
      photos: [
        { src: "images/06.jpg", alt: "That year", caption: "we got through it",
          back: "i keep this one in my wallet" },
        { src: "images/07.jpg", alt: "The end of that year", caption: "december",
          back: "" },
      ],
    },
    {
      date: "Now",
      title: "Still writing",
      body: [
        "End in the present tense. What today looks like. What you're in the middle of. What's still ahead of you both.",
      ],
      note: "and the next six",
      photos: [
        { src: "images/08.jpg", alt: "This year", caption: "this one's my favourite",
          back: "you were laughing at something off to the left" },
        { src: "images/09.jpg", alt: "This year, again", caption: "last week",
          back: "" },
        { src: "images/10.jpg", alt: "A morning recently", caption: "sunday",
          back: "nothing happened all day and it was perfect" },
        { src: "images/11.jpg", alt: "Recently", caption: "the good chair",
          back: "" },
      ],
    },
  ],

  /* --- THE SHOEBOX ------------------------------------------------------
     The loose pile. These fan out across the page as you scroll. 10–20 is
     the comfortable range — fewer looks thin, more starts to overlap.
     Each one can carry a `back:` line like the chapter photos do.
     -------------------------------------------------------------------- */
  shoebox: {
    heading: "everything else",
    note: "the ones that never made it into an album",
    photos: [
      { src: "images/b01.jpg", alt: "A loose print", caption: "brighton",     back: "you hated this beach" },
      { src: "images/b02.jpg", alt: "A loose print", caption: "your birthday" },
      { src: "images/b03.jpg", alt: "A loose print", caption: "the old car",  back: "it never started first time" },
      { src: "images/b04.jpg", alt: "A loose print", caption: "christmas" },
      { src: "images/b05.jpg", alt: "A loose print", caption: "the roof",     back: "we shouldn't have been up there" },
      { src: "images/b06.jpg", alt: "A loose print", caption: "somewhere" },
      { src: "images/b07.jpg", alt: "A loose print", caption: "the wedding",  back: "you cried and said you didn't" },
      { src: "images/b08.jpg", alt: "A loose print", caption: "sunday again" },
      { src: "images/b09.jpg", alt: "A loose print", caption: "the move",     back: "day one, nothing unpacked" },
      { src: "images/b10.jpg", alt: "A loose print", caption: "your mum's" },
      { src: "images/b11.jpg", alt: "A loose print", caption: "late",         back: "3am, kitchen floor, talking" },
      { src: "images/b12.jpg", alt: "A loose print", caption: "yesterday" },
    ],
  },

  /* --- THE LETTER — the whole point. Take your time with this. -----------
     It writes itself, word by word, as they scroll. One string per paragraph.
     Four or five paragraphs is the sweet spot — much longer and the scroll
     starts to feel like work.
     -------------------------------------------------------------------- */
  letter: {
    heading: "and one more thing",
    salutation: "Their name,",
    paragraphs: [
      "This is the part you should write yourself, in one sitting, without editing it afterwards. Say the thing you don't say out loud because it feels too large for a Tuesday.",
      "Tell them what changed in you. Not what you love about them — what being loved by them did. Those are different letters, and this is the second one.",
      "Name one small thing. The way they hold a cup. The sound they make finding something funny just before they laugh. Small is what survives.",
      "Then say what you want the next stretch to look like, and stop. The best ones are shorter than you think.",
    ],
    signoff: "always,",
    signature: "Your name",
  },

  /* --- THEIR TURN — the reply ---------------------------------------------
     A blank line at the end for them to write back on. What they type is kept
     in their browser as they go, and is sent to you only when they press the
     button — nothing goes anywhere on its own.

     SENDING IS CONFIGURED WITH ENVIRONMENT VARIABLES, NOT HERE:
       EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY
       (and EMAILJS_PRIVATE_KEY — see README.md)
     Set them on the Vercel project and put {{message}} in your EmailJS
     template. Without them the button simply copies to the clipboard.

     Only the wording lives here.
     -------------------------------------------------------------------- */
  reply: {
    prompt: "your turn",
    placeholder: "write back to me\u2026",

    /* button and status wording */
    send: "send it to me",
    sending: "sending\u2026",
    sent: "sent",
    button: "copy what you wrote",
    saved: "kept on this device",
    failed: "couldn't send just now \u2014 copy it instead",
    needsHosting: "sending works once the page is online",
  },

  /* --- THE CLOSING ------------------------------------------------------- */
  closing: {
    /* in your hand */
    line: "to be continued,\nin your handwriting",
    /* typewritten */
    note: "happy anniversary",
    /* typewritten, under the envelope once it seals itself */
    sealed: "sealed, and kept",
  },

  /* --- MUSIC — optional. Leave src as "" to hide the tab entirely. ------- */
  music: {
    src: "music/ours.mp3",
    title: "our song",
  },
};
