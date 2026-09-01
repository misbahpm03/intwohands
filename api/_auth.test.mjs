/* Run with:  npm test   (or  node api/_auth.test.mjs)
   The admin cookie is the only security-relevant logic here, so it gets a
   real check: a valid cookie passes, and every way of faking one fails. */

import assert from "node:assert/strict";
import { sign, verify, passwordMatches } from "./_auth.js";

const KEY = "a-test-secret";
const now = Date.now();
let n = 0;
const ok = (cond, what) => { assert.equal(cond, true, what); n++; console.log("ok — " + what); };

const good = sign(now + 60_000, KEY);

ok(verify(good, KEY, now), "a fresh cookie verifies");
ok(!verify(sign(now - 1, KEY), KEY, now), "an expired cookie is refused");
ok(!verify(good, "a-different-secret", now), "a cookie signed with another secret is refused");
ok(!verify(good, "", now), "with no secret configured it fails closed");
ok(!verify("", KEY, now), "an empty cookie is refused");
ok(!verify("garbage", KEY, now), "a cookie with no signature is refused");

const flipped = good.slice(0, -1) + (good.endsWith("A") ? "B" : "A");
ok(!verify(flipped, KEY, now), "a tampered signature is refused");

/* the attack that matters: keep the signature, push the expiry out */
const mac = good.slice(good.lastIndexOf(".") + 1);
ok(!verify(`${now + 999_999_999}.${mac}`, KEY, now), "extending the expiry invalidates the signature");

/* password comparison */
process.env.ADMIN_PASSWORD = "correct horse";
ok(passwordMatches("correct horse"), "the right password matches");
ok(!passwordMatches("correct hors"), "a shorter password does not match");
ok(!passwordMatches("correct horse "), "a longer password does not match");
ok(!passwordMatches(""), "an empty password does not match");
delete process.env.ADMIN_PASSWORD;
ok(!passwordMatches("anything"), "with no password configured nothing matches");

console.log(`\nadmin cookie: ${n} assertions passed`);
