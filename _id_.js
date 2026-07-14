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

  // Fetch real reviews for this product (no fake/seed data)
  let reviews = [];
  try {
    const revResp = await fetch(
      `${SUPABASE_URL}/rest/v1/reviews?product_id=eq.${encodeURIComponent(id)}&select=*&order=created_at.desc`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    reviews = await revResp.json();
    if (!Array.isArray(reviews)) reviews = [];
  } catch (e) {
    reviews = [];
  }
  const reviewCount = reviews.length;
  const avgRating = reviewCount > 0
    ? (reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / reviewCount)
    : 0;

  function starsHtml(value) {
    const rounded = Math.round(value * 2) / 2; // nearest half star
    let out = "";
    for (let i = 1; i <= 5; i++) {
      if (rounded >= i) out += "★";
      else if (rounded >= i - 0.5) out += "★"; // treat half as full visually, simplest for now
      else out += "☆";
    }
    return out;
  }

  const reviewsSection = `
    <div class="section-card" id="reviewsCard">
      <div class="section-title">Ratings &amp; reviews</div>
      ${reviewCount > 0 ? `
        <div class="rev-summary">
          <span class="rev-stars">${starsHtml(avgRating)}</span>
          <span class="rev-score">${avgRating.toFixed(1)}</span>
          <span class="rev-count">(${reviewCount} review${reviewCount === 1 ? "" : "s"})</span>
        </div>
        <ul class="rev-list">
          ${reviews.map(r => `
            <li class="rev-item">
              <div class="rev-item-top">
                <span class="rev-item-stars">${starsHtml(Number(r.rating || 0))}</span>
                <span class="rev-item-name">${esc(r.reviewer_name)}</span>
              </div>
              ${r.comment ? `<p class="rev-item-comment">${esc(r.comment)}</p>` : ""}
            </li>
          `).join("")}
        </ul>
      ` : `
        <p class="rev-empty">☆☆☆☆☆ No reviews yet — be the first to review this product.</p>
      `}
      <button type="button" class="rev-write-btn" id="revWriteBtn">Write a review</button>
      <form id="revForm" class="rev-form" style="display:none;">
        <div class="rev-form-stars" id="revStarPicker" data-value="0">
          ${[1,2,3,4,5].map(n => `<span class="rev-star-pick" data-star="${n}">☆</span>`).join("")}
        </div>
        <input type="hidden" id="revRatingInput" value="0" />
        <input type="text" id="revNameInput" placeholder="Your name" maxlength="60" required />
        <textarea id="revCommentInput" placeholder="Share your experience (optional)" maxlength="1000" rows="3"></textarea>
        <button type="submit" class="rev-submit-btn" id="revSubmitBtn">Submit review</button>
        <p class="rev-status" id="revStatus"></p>
      </form>
    </div>
  `;

  // Fetch a few other products to show as "More on Fyndit"
  let moreProducts = [];
  try {
    const moreResp = await fetch(
      `${SUPABASE_URL}/rest/v1/products?id=neq.${encodeURIComponent(id)}&select=id,name,price,images&order=created_at.desc&limit=6`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    moreProducts = await moreResp.json();
    if (!Array.isArray(moreProducts)) moreProducts = [];
  } catch (e) {
    moreProducts = [];
  }

  function firstImage(imgField) {
    try {
      let imgs = typeof imgField === "string" ? JSON.parse(imgField) : (imgField || []);
      if (!Array.isArray(imgs)) imgs = [imgs].filter(Boolean);
      return imgs[0] || "https://fyndit-eight.vercel.app/icon-512.png";
    } catch (e) {
      const parts = String(imgField || "").split(",").map(s => s.trim()).filter(Boolean);
      return parts[0] || "https://fyndit-eight.vercel.app/icon-512.png";
    }
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

  const idForClientJs = /^\d+$/.test(String(id)) ? String(id) : JSON.stringify(id);
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
    ? `<div class="g-dots">${images.map((_, i) => `<div class="g-dot${i === 0 ? " active" : ""}"></div>`).join("")}</div>`
    : "";

  const descLines = (product.description || "").split("\n").map(s => s.trim()).filter(Boolean);
  const descriptionBlock = descLines.length > 0
    ? `
      <details class="section-card" open>
        <summary>Description</summary>
        <ul class="desc-list">${descLines.map(line => `<li>${esc(line)}</li>`).join("")}</ul>
      </details>
    `
    : "";

  const benefits = [];
  if (product.free_shipping) benefits.push("Free shipping on this item");
  if (product.delivery_time) benefits.push(`Arrives in as little as ${esc(product.delivery_time)}`);
  benefits.push("Reviewed by Fyndit before being listed");
  benefits.push(product.is_own_product ? "Sold and fulfilled directly by Fyndit" : "You deal directly with the seller");

  const benefitsBlock = `
    <div class="section-card">
      <div class="section-title">Service &amp; benefits</div>
      <ul class="benefits-list">
        ${benefits.map(b => `<li>✓ ${esc(b)}</li>`).join("")}
      </ul>
    </div>
  `;

  const trustBlock = `
    <div class="section-card trust-card">
      <div class="section-title">Buying on Fyndit</div>
      <ul class="trust-list">
        <li>🔍 Every listing is checked by Fyndit before it goes live</li>
        <li>💬 You confirm final details and pay ${product.is_own_product ? "Fyndit" : "the seller"} directly on WhatsApp</li>
        <li>🧾 Sales are final — please confirm size, condition and details before paying</li>
      </ul>
    </div>
  `;

  const moreGrid = moreProducts.length > 0 ? `
    <div class="more-section">
      <div class="section-title" style="padding:0 18px;">More on Fyndit</div>
      <div class="more-grid">
        ${moreProducts.map(p => `
          <a class="more-card" href="/api/product/${esc(p.id)}">
            <img src="${esc(firstImage(p.images))}" alt="${esc(p.name)}" loading="lazy" />
            <div class="more-name">${esc(p.name)}</div>
            <div class="more-price">${esc(p.price)}</div>
          </a>
        `).join("")}
      </div>
    </div>
  ` : "";

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
    body { font-family: -apple-system, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 0 0 90px; color: #06255B; background: #F7F5F2; }
    .top-bar { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: rgba(247,245,242,0.94); backdrop-filter: blur(6px); border-bottom: 1px solid #EDE8E0; }
    .top-bar a.back-icon { color: #06255B; text-decoration: none; font-size: 20px; padding: 4px 8px; }
    .top-bar .brand { font-family: 'Archivo', sans-serif; font-weight: 900; font-size: 15px; color: #06255B; }
    .top-bar button.share-icon { background: none; border: none; font-size: 17px; padding: 4px 8px; color: #06255B; }
    .g-wrap { position: relative; background: #EDE8E0; }
    .g-scroll { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; }
    .g-scroll::-webkit-scrollbar { display: none; }
    .g-slide { flex: 0 0 100%; scroll-snap-align: start; aspect-ratio: 4/5; }
    .g-slide img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .g-counter { position: absolute; top: 12px; left: 12px; background: rgba(6,37,91,0.65); color: #fff; font-size: 11.5px; font-weight: 700; padding: 3px 9px; border-radius: 999px; }
    .g-dots { display: flex; gap: 5px; justify-content: center; padding: 10px 0; }
    .g-dot { width: 6px; height: 6px; border-radius: 999px; background: rgba(6,37,91,0.25); }
    .g-dot.active { background: #FE6402; width: 16px; border-radius: 999px; }
    .content { padding: 16px 18px 4px; }
    .tag-row { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 10px; }
    .tag { font-size: 11px; font-weight: 800; padding: 4px 9px; border-radius: 6px; }
    .tag.sale { background: #FE6402; color: #fff; }
    .tag.ship { background: #E8F5E9; color: #1B6B2E; }
    .tag.cat { background: #EDE8E0; color: #06255B; }
    h1 { font-size: 19px; margin: 0 0 8px; line-height: 1.35; }
    .sold-by { display: block; font-size: 12px; font-weight: 800; color: #FE6402; text-transform: uppercase; letter-spacing: 0.02em; margin-bottom: 6px; }
    .price-row { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 4px; }
    .price { font-size: 27px; font-weight: 900; color: #FE6402; }
    .original-price { font-size: 15px; color: #8A8577; text-decoration: line-through; }
    .discount-badge { display: inline-block; background: #06255B; color: #fff; font-size: 12px; font-weight: 800; padding: 3px 9px; border-radius: 6px; margin: 4px 0 14px; }
    .delivery-banner { display: flex; align-items: center; gap: 8px; background: #FFF3D6; color: #7A5A00; font-size: 13px; font-weight: 700; padding: 10px 12px; border-radius: 10px; margin: 6px 0 16px; }
    .note { color: #635E52; font-size: 14.5px; line-height: 1.5; margin: 0 0 16px; }
    .section-card { background: #FFFFFF; border: 1px solid #EDE8E0; border-radius: 12px; padding: 14px 16px; margin: 0 18px 14px; }
    .section-title { font-size: 13.5px; font-weight: 800; margin: 0 0 8px; }
    details.section-card summary { font-size: 13.5px; font-weight: 800; cursor: pointer; list-style: none; }
    details.section-card summary::-webkit-details-marker { display: none; }
    details.section-card summary::after { content: '▾'; float: right; color: #8A8577; }
    details.section-card[open] summary::after { content: '▴'; }
    .desc-list { margin: 10px 0 0; padding-left: 18px; }
    .desc-list li { font-size: 14px; color: #635E52; line-height: 1.6; margin-bottom: 4px; }
    .benefits-list, .trust-list { margin: 0; padding: 0; list-style: none; }
    .benefits-list li { font-size: 13.5px; color: #1B6B2E; font-weight: 700; line-height: 1.9; }
    .trust-list li { font-size: 13.5px; color: #635E52; line-height: 1.9; }
    .payment-info { background: #EDE8E0; border-radius: 10px; padding: 12px 14px; font-size: 13.5px; color: #06255B; line-height: 1.6; margin: 0 18px 14px; white-space: pre-wrap; }
    .cta-bar { position: fixed; bottom: 0; left: 0; right: 0; max-width: 480px; margin: 0 auto; background: #FFFFFF; border-top: 1px solid #EDE8E0; padding: 10px 16px; display: flex; align-items: center; gap: 12px; z-index: 20; }
    .cta-bar .cta-price { font-family: 'Archivo', sans-serif; font-weight: 900; font-size: 17px; color: #06255B; white-space: nowrap; }
    a.cta { flex: 1; text-align: center; background: #FE6402; color: #06255B; font-weight: 900; font-size: 15.5px; text-decoration: none; padding: 13px; border-radius: 10px; }
    .more-section { margin-top: 6px; padding-bottom: 8px; }
    .more-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; padding: 10px 18px 0; }
    .more-card { display: block; background: #fff; border: 1px solid #EDE8E0; border-radius: 12px; overflow: hidden; text-decoration: none; color: #06255B; }
    .more-card img { width: 100%; aspect-ratio: 1; object-fit: cover; display: block; }
    .more-name { font-size: 12px; font-weight: 700; padding: 8px 8px 0; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .more-price { font-size: 12.5px; font-weight: 800; color: #FE6402; padding: 3px 8px 9px; }
    a.back { display: block; text-align: center; margin: 18px 0 0; color: #8A8577; font-size: 13px; text-decoration: none; }
    .rev-summary { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .rev-stars { color: #FCC601; font-size: 16px; letter-spacing: 1px; }
    .rev-score { font-weight: 900; font-size: 15px; color: #06255B; }
    .rev-count { font-size: 12.5px; color: #8A8577; }
    .rev-empty { font-size: 13.5px; color: #8A8577; margin: 0 0 12px; }
    .rev-list { list-style: none; margin: 0 0 12px; padding: 0; }
    .rev-item { padding: 10px 0; border-top: 1px solid #F0EBE0; }
    .rev-item:first-child { border-top: none; }
    .rev-item-top { display: flex; align-items: center; gap: 8px; }
    .rev-item-stars { color: #FCC601; font-size: 13px; letter-spacing: 1px; }
    .rev-item-name { font-size: 12.5px; font-weight: 700; color: #06255B; }
    .rev-item-comment { font-size: 13.5px; color: #635E52; margin: 4px 0 0; line-height: 1.5; }
    .rev-write-btn { background: none; border: 1.5px solid #FE6402; color: #FE6402; font-weight: 800; font-size: 13px; padding: 9px 14px; border-radius: 9px; width: 100%; }
    .rev-form { display: flex; flex-direction: column; gap: 8px; margin-top: 12px; }
    .rev-form-stars { font-size: 24px; letter-spacing: 4px; }
    .rev-star-pick { cursor: pointer; color: #D8D2C6; }
    .rev-star-pick.filled { color: #FCC601; }
    .rev-form input, .rev-form textarea { border: 1.5px solid #E3DDD0; border-radius: 8px; padding: 10px 12px; font-size: 14px; font-family: inherit; outline: none; }
    .rev-submit-btn { background: #06255B; color: #fff; font-weight: 800; font-size: 13.5px; padding: 11px 0; border: none; border-radius: 9px; }
    .rev-submit-btn:disabled { background: #D8D2C6; }
    .rev-status { font-size: 12.5px; color: #8A8577; margin: 0; min-height: 16px; }
  </style>
</head>
<body>
  <div class="top-bar">
    <a class="back-icon" href="/">&larr;</a>
    <span class="brand">Fyndit</span>
    <button class="share-icon" id="shareBtn" type="button">&#x1F517;</button>
  </div>

  <div class="g-wrap">
    <div class="g-scroll" id="gScroll">${gallerySlides}</div>
    ${images.length > 1 ? `<div class="g-counter" id="gCounter">1/${images.length}</div>` : ""}
    ${galleryDots}
  </div>

  <div class="content">
    <div class="tag-row">
      ${discountPercent ? `<span class="tag sale">${discountPercent}% OFF</span>` : ""}
      ${product.free_shipping ? `<span class="tag ship">Free shipping</span>` : ""}
      ${product.category ? `<span class="tag cat">${esc(product.category)}</span>` : ""}
    </div>
    ${product.seller_name ? `<span class="sold-by">Sold by ${esc(product.seller_name)}</span>` : ""}
    <h1>${esc(product.name)}</h1>
    <div class="price-row">
      <span class="price">${esc(product.price)}</span>
      ${product.original_price ? `<span class="original-price">${esc(product.original_price)}</span>` : ""}
    </div>
    ${product.delivery_time ? `<div class="delivery-banner">🚚 Arrives in as little as ${esc(product.delivery_time)}</div>` : ""}
    ${product.note ? `<div class="note">${esc(product.note)}</div>` : ""}
  </div>

  ${benefitsBlock}
  ${descriptionBlock}
  ${reviewsSection}
  ${trustBlock}
  ${product.is_own_product && product.payment_info ? `<div class="payment-info">${esc(product.payment_info)}</div>` : ""}

  <div class="content">
    <a class="back" href="/">&larr; More deals on Fyndit</a>
  </div>

  ${moreGrid}

  <div class="cta-bar">
    <span class="cta-price">${esc(product.price)}</span>
    ${product.is_own_product
      ? `<a class="cta" href="https://wa.me/${esc((product.seller_contact || "2347082795417").replace(/[^0-9]/g, ""))}?text=${encodeURIComponent(`Hi, I'd like to buy "${product.name}" for ${product.price} on Fyndit.`)}" target="_blank" rel="noopener noreferrer">Get deal &rarr;</a>`
      : `<a class="cta" href="${esc(product.link)}" target="_blank" rel="noopener noreferrer">Get deal &rarr;</a>`}
  </div>

  <script>
    (function () {
      var scroller = document.getElementById('gScroll');
      var counter = document.getElementById('gCounter');
      var dots = document.querySelectorAll('.g-dot');
      if (scroller) {
        scroller.addEventListener('scroll', function () {
          var idx = Math.round(scroller.scrollLeft / scroller.clientWidth);
          if (counter) counter.textContent = (idx + 1) + '/' + dots.length;
          dots.forEach(function (d, i) { d.classList.toggle('active', i === idx); });
        });
      }
      var writeBtn = document.getElementById('revWriteBtn');
      var revForm = document.getElementById('revForm');
      if (writeBtn && revForm) {
        writeBtn.addEventListener('click', function () {
          revForm.style.display = revForm.style.display === 'none' ? 'flex' : 'none';
        });
      }

      var starPicker = document.getElementById('revStarPicker');
      var ratingInput = document.getElementById('revRatingInput');
      if (starPicker && ratingInput) {
        var starEls = starPicker.querySelectorAll('.rev-star-pick');
        starEls.forEach(function (el) {
          el.addEventListener('click', function () {
            var val = parseInt(el.getAttribute('data-star'), 10);
            ratingInput.value = val;
            starEls.forEach(function (s) {
              var sv = parseInt(s.getAttribute('data-star'), 10);
              s.textContent = sv <= val ? '★' : '☆';
              s.classList.toggle('filled', sv <= val);
            });
          });
        });
      }

      if (revForm) {
        revForm.addEventListener('submit', function (e) {
          e.preventDefault();
          var statusEl = document.getElementById('revStatus');
          var submitBtn = document.getElementById('revSubmitBtn');
          var rating = parseInt(ratingInput.value, 10);
          var name = document.getElementById('revNameInput').value.trim();
          var comment = document.getElementById('revCommentInput').value.trim();
          if (!rating) {
            if (statusEl) statusEl.textContent = 'Please tap a star to choose a rating.';
            return;
          }
          if (!name) {
            if (statusEl) statusEl.textContent = 'Please enter your name.';
            return;
          }
          submitBtn.disabled = true;
          submitBtn.textContent = 'Submitting...';
          fetch('${SUPABASE_URL}/rest/v1/reviews', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': '${SUPABASE_KEY}',
              'Authorization': 'Bearer ${SUPABASE_KEY}',
              'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
              product_id: ${idForClientJs},
              reviewer_name: name,
              rating: rating,
              comment: comment || null
            })
          }).then(function (r) {
            if (!r.ok) throw new Error('Failed');
            window.location.reload();
          }).catch(function () {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit review';
            if (statusEl) statusEl.textContent = 'Something went wrong. Please try again.';
          });
        });
      }

      var shareBtn = document.getElementById('shareBtn');
      if (shareBtn) {
        shareBtn.addEventListener('click', function () {
          var url = window.location.href;
          if (navigator.share) {
            navigator.share({ title: document.title, url: url }).catch(function () {});
          } else if (navigator.clipboard) {
            navigator.clipboard.writeText(url);
            shareBtn.textContent = '✓';
            setTimeout(function () { shareBtn.textContent = '🔗'; }, 1500);
          }
        });
      }
    })();
  </script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html");
  res.statusCode = 200;
  return res.end(html);
}
