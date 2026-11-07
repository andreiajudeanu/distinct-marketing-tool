// Injected into a page with chrome.scripting. The last expression is the result.
(() => {
  const OFFER_PATTERN = /most[răa]|sample|discovery|descoperire|pachet|bundle|\bset\b|livrare|transport|shipping|delivery|versand|retur|garan[tț]|return|guarantee|reducere|discount|\d+\s?%|promo|cupon|coupon/i;
  const EXCLUDED = '#distinct-watch-preview, nav, footer, script, style, noscript, [aria-hidden="true"], [class*="cookie" i], [id*="cookie" i], [class*="consent" i]';
  const CHALLENGE = /captcha|verify you are human|verifică dacă ești om|access denied|acces refuzat|just a moment|enable javascript and cookies/i;

  const asArray = (value) => (Array.isArray(value) ? value : value ? [value] : []);
  const meta = (name) => document.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.content ?? '';

  function findProduct(node) {
    for (const item of asArray(node)) {
      if (!item || typeof item !== 'object') continue;
      if (asArray(item['@type']).includes('Product')) return item;
      const nested = findProduct(item['@graph']);
      if (nested) return nested;
    }
    return null;
  }

  function jsonLdProduct() {
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const product = findProduct(JSON.parse(script.textContent));
        if (product) return product;
      } catch {
        // Malformed JSON-LD is common. The meta tags below are the fallback.
      }
    }
    return null;
  }

  function visible(element) {
    return element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';
  }

  function textBlocks() {
    const root = document.querySelector('main') ?? document.body;
    const blocks = [];
    for (const element of root.querySelectorAll('p, li, span, div, h2, h3, h4, a, strong, small, td')) {
      if (element.closest(EXCLUDED) || element.querySelector('p, li, div, ul, h2, h3, h4') || !visible(element)) continue;
      const text = element.innerText?.replace(/\s+/g, ' ').trim() ?? '';
      if (text.length >= 8 && text.length <= 140) blocks.push(text);
    }
    return [...new Set(blocks)];
  }

  const product = jsonLdProduct();
  const offer = asArray(product?.offers)[0] ?? {};
  const destinations = asArray(offer.shippingDetails)
    .flatMap((detail) => asArray(detail.shippingDestination))
    .flatMap((region) => asArray(region.addressCountry))
    .map((country) => (typeof country === 'string' ? country : country?.name ?? ''))
    .filter(Boolean);
  const blocks = textBlocks();
  const bodyText = document.body?.innerText?.slice(0, 3000) ?? '';
  const priceNode = document.querySelector('[itemprop="price"]');
  const itemPrice = priceNode?.getAttribute('content') || priceNode?.textContent?.trim() || '';
  const navigation = performance.getEntriesByType('navigation')[0];

  return {
    url: location.href.split('#')[0],
    title: document.title,
    lang: document.documentElement.lang ?? '',
    httpStatus: navigation?.responseStatus ?? 0,
    challenge: !product && CHALLENGE.test(`${document.title} ${bodyText}`),
    sellerMentions: blocks.filter((text) => /vândut de|vandut de|sold by/i.test(text)).length,
    shipsTo: destinations,
    product: {
      name: product?.name || meta('og:title') || document.querySelector('h1')?.innerText || '',
      category: typeof product?.category === 'string' ? product.category : '',
      description: product?.description || meta('og:description') || '',
      availability: String(offer.availability ?? '').split('/').pop(),
      price: offer.price || offer.lowPrice || meta('product:price:amount') || itemPrice || '',
      currency: offer.priceCurrency || meta('product:price:currency') || '',
    },
    offers: blocks.filter((text) => OFFER_PATTERN.test(text)).slice(0, 30),
  };
})();
