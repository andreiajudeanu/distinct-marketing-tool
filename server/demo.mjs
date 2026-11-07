// Fictional demo store and rivals. All brands and prices here are invented.

const state = { phase: 'before' };

export const getPhase = () => state.phase;
export function setPhase(phase) {
  state.phase = phase === 'after' ? 'after' : 'before';
}

const SHOPS = {
  shop: {
    brand: 'Atelier Aroma',
    product: 'Nocturne Sandalwood Perfume 50 ml',
    price: 349,
    description: 'Niche perfume with sandalwood and smoked vanilla.',
    offers: ['Free shipping over 250 lei', 'Free returns within 14 days'],
    accent: '#7a3e1d',
  },
  'rival-a': {
    brand: 'Casa de Parfum',
    product: 'Oud Wood Perfume 50 ml',
    price: 329,
    description: 'Niche perfume with oud and amber.',
    offers: ['Free shipping over 300 lei'],
    afterOffers: ['Free shipping over 300 lei', 'Set of 3 samples of 2 ml for 39 lei'],
    accent: '#27504a',
  },
  'rival-b': {
    brand: 'Nota Lemnoasa',
    product: 'White Cedar Perfume 50 ml',
    price: 365,
    description: 'Woody perfume with cedar and iris.',
    offers: ['Free returns within 30 days'],
    afterOffers: ['Free returns within 30 days', 'Discovery bundle: 5 samples for 59 lei'],
    accent: '#3d3a78',
  },
};

function jsonLd({ name, brand, description, price, currency, country }) {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    brand: { '@type': 'Brand', name: brand },
    category: 'Perfumes',
    description,
    offers: {
      '@type': 'Offer',
      price,
      priceCurrency: currency,
      availability: 'https://schema.org/InStock',
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingDestination: { '@type': 'DefinedRegion', addressCountry: country },
      },
    },
  });
}

function layout({ lang = 'en', title, accent, brand, product, price, description, offers, extra = '', ld }) {
  const today = new Date().toLocaleDateString('en-GB');
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<script type="application/ld+json">${ld}</script>
<style>
  :root { --accent: ${accent}; }
  body { margin: 0; font: 16px/1.5 Georgia, serif; color: #241f1a; background: #fbf8f3; }
  nav { padding: 16px 24px; background: var(--accent); color: #fff; font-size: 18px; }
  main { max-width: 860px; margin: 32px auto; padding: 0 16px; display: grid; gap: 32px;
         grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
  .bottle { aspect-ratio: 4/5; border-radius: 12px; background: linear-gradient(160deg, var(--accent), #e9d9c4); }
  h1 { margin: 0 0 8px; font-size: 30px; line-height: 1.2; }
  .price { font-size: 26px; margin: 8px 0 16px; }
  ul { padding-left: 18px; }
  button { width: 100%; padding: 14px; border: 0; border-radius: 8px; color: #fff;
           background: var(--accent); font: inherit; cursor: pointer; }
  footer { margin-top: 48px; padding: 16px 24px; color: #6d6459; font-size: 13px; }
  .cookie { position: fixed; right: 16px; bottom: 16px; padding: 10px 12px; font-size: 12px;
            background: #fff; border: 1px solid #ddd; border-radius: 8px; }
</style>
</head>
<body>
<nav>${brand}</nav>
<main>
  <div class="bottle" role="img" aria-label="Perfume bottle"></div>
  <section>
    <h1>${product}</h1>
    <p>${description}</p>
    <div class="price">${price}</div>
    <ul>${offers.map((offer) => `<li>${offer}</li>`).join('')}</ul>
    ${extra}
    <button type="button">Add to cart</button>
  </section>
</main>
<footer>© ${brand}. Fictional demo page, updated ${today}.</footer>
<div class="cookie">We use cookies to deliver content.</div>
</body>
</html>`;
}

function shopPage(key) {
  const shop = SHOPS[key];
  const offers = state.phase === 'after' && shop.afterOffers ? shop.afterOffers : shop.offers;
  return layout({
    title: `${shop.product} | ${shop.brand}`,
    accent: shop.accent,
    brand: shop.brand,
    product: shop.product,
    price: `${shop.price} lei`,
    description: shop.description,
    offers,
    ld: jsonLd({
      name: shop.product, brand: shop.brand, description: shop.description,
      price: shop.price, currency: 'RON', country: 'RO',
    }),
  });
}

function marketplacePage() {
  const extra = ['Parfumeria Nord', 'Beauty Depot', 'Lux Outlet']
    .map((seller, index) => `<p>Sold by ${seller}: ${319 + index * 12} lei</p>`).join('');
  return layout({
    title: 'Oud Perfume 50 ml | Big Market',
    accent: '#a12b2b',
    brand: 'Big Market',
    product: 'Oud Perfume 50 ml',
    price: 'from 319 lei',
    description: 'Offers from several sellers.',
    offers: ['Delivery in 24 hours'],
    extra,
    ld: jsonLd({
      name: 'Parfum Oud 50 ml', brand: 'Diverse', description: 'Offers from several sellers.',
      price: 319, currency: 'RON', country: 'RO',
    }),
  });
}

function foreignPage() {
  return layout({
    lang: 'de',
    title: 'Santal Noir 50 ml | Maison Lumen',
    accent: '#34495e',
    brand: 'Maison Lumen',
    product: 'Santal Noir 50 ml',
    price: '79 EUR',
    description: 'Nischenparfum mit Sandelholz.',
    offers: ['Kostenloser Versand ab 60 EUR'],
    ld: jsonLd({
      name: 'Santal Noir 50 ml', brand: 'Maison Lumen', description: 'Nischenparfum mit Sandelholz.',
      price: 79, currency: 'EUR', country: 'DE',
    }),
  });
}

const BLOCKED_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Access denied</title></head><body><h1>Access denied</h1>
<p>This demo page simulates a store that blocks access.</p></body></html>`;

function controlPage() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Demo control</title>
<style>body{max-width:520px;margin:48px auto;padding:0 16px;font:16px/1.5 system-ui,sans-serif}
button{margin:0 8px 8px 0;padding:10px 14px;font:inherit;cursor:pointer}</style></head>
<body><h1>Demo control</h1>
<p>Rival state: <strong id="phase">${state.phase}</strong></p>
<button data-phase="before">Before</button><button data-phase="after">After</button>
<p><a href="/demo/shop">Open the demo store</a></p>
<script>
document.querySelectorAll('button').forEach((button) => button.addEventListener('click', async () => {
  const response = await fetch('/demo/state', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phase: button.dataset.phase }) });
  document.getElementById('phase').textContent = (await response.json()).phase;
}));
</script></body></html>`;
}

export function renderDemo(path) {
  const route = path.replace(/^\/demo\/?/, '').replace(/\/$/, '');
  if (route in SHOPS) return { status: 200, html: shopPage(route) };
  if (route === 'marketplace') return { status: 200, html: marketplacePage() };
  if (route === 'foreign') return { status: 200, html: foreignPage() };
  if (route === 'rival-c') return { status: 403, html: BLOCKED_PAGE };
  if (route === 'control' || route === '') return { status: 200, html: controlPage() };
  return { status: 404, html: '<!doctype html><title>Not found</title><h1>Page not found</h1>' };
}
