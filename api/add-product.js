export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { password, product } = req.body || {};
  const correctPassword = process.env.ADMIN_PASSWORD;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!correctPassword || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return res.status(500).json({ ok: false, error: "Server not configured" });
  }

  if (password !== correctPassword) {
    return res.status(401).json({ ok: false, error: "Incorrect password" });
  }

  if (!product || !product.name || !product.price || !product.link) {
    return res.status(400).json({ ok: false, error: "Missing product fields" });
  }

  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/products`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(product),
    });
    if (!resp.ok) throw new Error("insert failed");
    const data = await resp.json();
    return res.status(200).json({ ok: true, data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "Could not add product" });
  }
}
