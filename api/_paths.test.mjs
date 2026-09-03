/* Run with:  npm test

   Vercel serves admin/index.html at /admin with no redirect to /admin/, so a
   relative href resolves one directory too high: `admin.css` becomes
   /admin.css, which 404s, and the editor loads with no stylesheet and no
   JavaScript. It happened, it was invisible in the deploy log, and nothing
   about it is obvious from reading the HTML. Hence this check. */

import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

let n = 0;
const ok = (cond, what) => { assert.equal(cond, true, what); n++; console.log("ok — " + what); };

/* every src="…" / href="…" that points at a file in this repo */
const localRefs = (html) =>
  [...html.matchAll(/\b(?:src|href)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((u) => !/^(?:[a-z]+:)?\/\//i.test(u) && !u.startsWith("#") && !u.startsWith("data:"));

/* Only the admin page. The letter at index.html is served at "/", which
   already ends in a slash, and its relative paths are deliberate: the README
   promises it can be opened straight off disk, which root-absolute paths
   would break. The admin page has never worked that way — it needs the API. */
for (const page of ["admin/index.html"]) {
  const html = readFileSync(join(root, page), "utf8");

  for (const ref of localRefs(html)) {
    ok(ref.startsWith("/"), `${page}: ${ref} is root-absolute`);

    /* and it has to actually be there */
    const onDisk = join(root, ref.replace(/^\//, ""));
    if (!ref.endsWith("/")) {
      ok(existsSync(onDisk), `${page}: ${ref} exists on disk`);
    }
  }
}

console.log(`\nasset paths: ${n} assertions passed`);
