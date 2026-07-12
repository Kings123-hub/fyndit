export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { password } = req.body || {};
  const correctPassword = process.env.ADMIN_PASSWORD;

  if (!correctPassword) {
    // Env var not set yet in Vercel — fail closed, not open.
    return res.status(500).json({ ok: false, error: "Server not configured" });
  }

  if (password === correctPassword) {
    return res.status(200).json({ ok: true });
  }

  return res.status(200).json({ ok: false });
}
