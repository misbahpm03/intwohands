import { sign, cookieHeader, passwordMatches, readJson, isAdmin, MAX_AGE } from "./_auth.js";

export default async function handler(req, res) {
  /* is this browser already signed in? */
  if (req.method === "GET") {
    return res.status(200).json({ authed: isAdmin(req) });
  }

  /* sign out */
  if (req.method === "DELETE") {
    res.setHeader("Set-Cookie", cookieHeader("", { maxAge: 0 }));
    return res.status(200).json({ ok: true });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "method not allowed" });
  }

  if (!process.env.ADMIN_PASSWORD || !process.env.ADMIN_SECRET) {
    return res.status(500).json({
      error: "ADMIN_PASSWORD and ADMIN_SECRET are not set on this deployment",
    });
  }

  const body = await readJson(req);

  if (!passwordMatches(body.password)) {
    /* blunt the guessing rate a little; the password is the only gate */
    await new Promise((r) => setTimeout(r, 500));
    return res.status(401).json({ error: "wrong password" });
  }

  res.setHeader("Set-Cookie", cookieHeader(sign(Date.now() + MAX_AGE * 1000)));
  return res.status(200).json({ ok: true });
}
