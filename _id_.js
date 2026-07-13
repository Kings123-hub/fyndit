const SUPABASE_URL = "https://mrnssxulfkacrrgsixnf.supabase.co";
const SUPABASE_KEY = "sb_publishable_F0VmiKD01luzB61meBYqSQ_y98ofr0I";

function esc(str) {
  return String(str || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function parseNumber(str) {
  if (!str) return null;
  const cleaned = String(str).replace(/[^0-9.]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    res.statusCode = 404;
    return res.end("Product not found");
  }

  let product = null;
  try {
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(id)}&select=*`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const data = await resp.json();
    product = data && data[0];
  } catch (err) {
    // fall through to not-found below
  }

  if (!product) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/html");
    return res.end(`<!DOCTYPE html><html><head><title>Deal not found — Fyndit</title></head>
      <body><h1>Deal not found</h1><p>This deal may have expired or been removed.</p>
      <a href="/">Back to Fyndit</a></body></html>`);
  }

  let images = [];
  try {
    images = typeof product.images === "string" ? JSON.parse(product.images) : (product.images || []);
    if (!Array.isArray(images)) images = [images].filter(Boolean);
  } catch (e) {
    images = product.images ? String(product.images).split(",").map(s => s.trim()).filter(Boolean) : [];
  }
  if (images.length === 0) images = [`https://fyndit-eight.vercel.app/icon-512.png`];

  const priceNum = parseNumber(product.price);
  const originalNum = parseNumber(product.original_price);
  let discountPercent = null;
  if (priceNum && originalNum && originalNum > priceNum) {
    discountPercent = Math.round(((originalNum - priceNum) / originalNum) * 100);
  }

  const pageUrl = `https://fyndit-eight.vercel.app/api/product/${encodeURIComponent(id)}`;
  const title = `${esc(product.name)} — ${esc(product.price)} | Fyndit`;
  const description = product.note
    ? esc(product.note)
    : `${esc(product.name)} — spotted at ${esc(product.price)} on Fyndit, curated deals in Nigeria.`;

  const gallerySlides = images.map((img, i) => `
    <div class="g-slide">
      <img src="${esc(img)}" alt="${esc(product.name)} photo ${i + 1}" loading="${i === 0 ? "eager" : "lazy"}" />
    </div>
  `).join("");

  const galleryDots = images.length > 1
    ? `<div class="g-dots">${images.map(() => `<div class="g-dot"></div>`).join("")}</div>`
    : "";

  const descLines = (product.description || "").split("\n").map(s => s.trim()).filter(Boolean);
  const descriptionList = descLines.length > 0
    ? `<div class="desc-title">Description</div><ul class="desc-list">${descLines.map(line => `<li>${esc(line)}</li>`).join("")}</ul>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="${pageUrl}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${esc(images[0])}" />
  <meta property="og:url" content="${pageUrl}" />
  <meta property="og:type" content="product" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="icon" type="image/png" href="/icon-192.png" />
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 0 0 30px; color: #06255B; background: #F7F5F2; }
    .g-wrap { position: relative; background: #EDE8E0; }
    .g-scroll { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; }
    .g-scroll::-webkit-scrollbar { display: none; }
    .g-slide { flex: 0 0 100%; scroll-snap-align: start; aspect-ratio: 4/5; }
    .g-slide img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .g-dots { display: flex; gap: 5px; justify-content: center; padding: 10px 0; }
    .g-dot { width: 6px; height: 6px; border-radius: 999px; background: rgba(6,37,91,0.25); }
    .content { padding: 16px 18px; }
    h1 { font-size: 19px; margin: 0 0 8px; line-height: 1.35; }
    .price-row { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 4px; }
    .price { font-size: 26px; font-weight: 900; color: #FE6402; }
    .original-price { font-size: 15px; color: #8A8577; text-decoration: line-through; }
    .discount-badge { display: inline-block; background: #06255B; color: #fff; font-size: 12px; font-weight: 800; padding: 3px 9px; border-radius: 6px; margin-bottom: 14px; }
    .badges-row { display: flex; gap: 8px; flex-wrap: wrap; margin: 4px 0 16px; }
    .badge { display: inline-flex; align-items: center; gap: 4px; background: #E8F5E9; color: #1B6B2E; font-size: 12.5px; font-weight: 700; padding: 5px 10px; border-radius: 999px; }
    .desc-title { font-size: 14px; font-weight: 800; margin: 4px 0 8px; }
    .desc-list { margin: 0 0 22px; padding-left: 18px; }
    .desc-list li { font-size: 14px; color: #635E52; line-height: 1.6; margin-bottom: 4px; }
    .note { color: #635E52; font-size: 14.5px; line-height: 1.5; margin: 10px 0 22px; }
    .sold-by { display: inline-block; font-size: 12px; font-weight: 800; color: #FE6402; text-transform: uppercase; letter-spacing: 0.02em; margin-bottom: 6px; }
    .payment-info { background: #EDE8E0; border-radius: 10px; padding: 12px 14px; font-size: 13.5px; color: #06255B; line-height: 1.6; margin: 10px 0 18px; white-space: pre-wrap; }
    a.cta { display: block; text-align: center; background: #FE6402; color: #06255B; font-weight: 900; font-size: 17px; text-decoration: none; padding: 16px; border-radius: 12px; box-shadow: 0 4px 14px rgba(254,100,2,0.35); }
    a.back { display: block; text-align: center; margin-top: 18px; color: #8A8577; font-size: 13px; text-decoration: none; }
  </style>
</head>
<body>
  <div class="g-wrap">
    <div class="g-scroll">${gallerySlides}</div>
    ${galleryDots}
  </div>
  <div class="content">
    ${product.seller_name ? `<div class="sold-by">Sold by ${esc(product.seller_name)}</div>` : ""}
    <h1>${esc(product.name)}</h1>
    <div class="price-row">
      <span class="price">${esc(product.price)}</span>
      ${product.original_price ? `<span class="original-price">${esc(product.original_price)}</span>` : ""}
    </div>
    ${discountPercent ? `<div class="discount-badge">${discountPercent}% OFF</div>` : ""}
    <div class="badges-row">
      ${product.free_shipping ? `<span class="badge">✓ Free shipping</span>` : ""}
      ${product.delivery_time ? `<span class="badge">🚚 Arrives in ${esc(product.delivery_time)}</span>` : ""}
    </div>
    ${product.note ? `<div class="note">${esc(product.note)}</div>` : ""}
    ${descriptionList}
    ${product.is_own_product ? `
      <div class="payment-info">${product.payment_info ? esc(product.payment_info) : "Message us on WhatsApp to arrange payment and delivery."}</div>
      <a class="cta" href="https://wa.me/${esc((product.seller_contact || "2347082795417").replace(/[^0-9]/g, ""))}?text=${encodeURIComponent(`Hi, I'd like to buy "${product.name}" for ${product.price} on Fyndit.`)}" target="_blank" rel="noopener noreferrer">View this deal &rarr;</a>
    ` : `
      <a class="cta" href="${esc(product.link)}" target="_blank" rel="noopener noreferrer">View this deal &rarr;</a>
    `}
    <a class="back" href="/">&larr; More deals on Fyndit</a>
  </div>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html");
  res.statusCode = 200;
  return res.end(html);
}
