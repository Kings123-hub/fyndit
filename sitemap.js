const SUPABASE_URL = "https://mrnssxulfkacrrgsixnf.supabase.co";
const SUPABASE_KEY = "sb_publishable_F0VmiKD01luzB61meBYqSQ_y98ofr0I";

export default async function handler(req, res) {
  let products = [];
  try {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/products?select=id`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    products = await resp.json();
    if (!Array.isArray(products)) products = [];
  } catch (err) {
    products = [];
  }

  const urls = products.map(
    (p) => `  <url>
    <loc>https://fyndit-eight.vercel.app/api/product/${encodeURIComponent(p.id)}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`
  ).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://fyndit-eight.vercel.app/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
${urls}
</urlset>`;

  res.setHeader("Content-Type", "application/xml");
  res.statusCode = 200;
  return res.end(xml);
}
