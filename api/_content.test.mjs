/* Run with:  npm test

   invalid() is the only thing standing between a mis-click in the editor and
   a blanked letter, and it used to wave through an empty one. */

import assert from "node:assert/strict";
import { invalid, realDate } from "./content.js";

let n = 0;
const ok = (cond, what) => { assert.equal(cond, true, what); n++; console.log("ok — " + what); };

const letter = () => ({
  names: { one: "A", two: "B" },
  startDate: "2019-11-08",
  chapters: [],
  letter: { paragraphs: ["the first line"] },
});

ok(invalid(letter()) === null, "a complete letter saves");

/* the whole point of the check */
const blank = letter();
blank.letter.paragraphs = [];
ok(invalid(blank) === "the letter itself can't be empty", "an empty letter is refused");

const noName = letter();
noName.names.one = "";
ok(invalid(noName) === "your name and their name can't be empty", "a missing name is refused");

/* a real date, not just the right shape */
ok(realDate("2019-11-08"), "a real date passes");
ok(!realDate("2019-13-45"), "a well-shaped impossible date is refused");
ok(!realDate("2019-02-30"), "the 30th of February is refused");
ok(realDate("2020-02-29"), "a leap day passes");
ok(!realDate("08-11-2019"), "the wrong order is refused");
ok(!realDate(""), "an empty date is refused");
ok(realDate(" 2019-11-08 "), "surrounding whitespace is ignored");

const badDate = letter();
badDate.startDate = "2019-13-45";
ok(invalid(badDate) === "the date it started isn't a real date", "an impossible date is refused");

ok(invalid(null) === "that isn't a letter", "nothing at all is refused");
ok(invalid([]) === "that isn't a letter", "a list is refused");

console.log(`\ncontent validation: ${n} assertions passed`);
