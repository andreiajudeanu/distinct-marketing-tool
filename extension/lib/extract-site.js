// Reads a whole website page. Used by the panel through chrome.scripting and by the
// Python backend through Playwright, so both sides see pages the same way.
// The last expression is the result. Nothing outside this function is available.
(() => {
  const CHALLENGE = /captcha|verify you are human|verifică dacă ești om|access denied|acces refuzat|just a moment|enable javascript and cookies/i;
  const EXCLUDED = '#distinct-watch-preview, script, style, noscript, [aria-hidden="true"]';
  const PRICE = /(?:€|\$|£)\s?\d[\d.,]*|\d[\d.,]*\s?(?:lei|ron|eur|usd|gbp|€|\$|£)\b/gi;
  const CTA_HINT = /btn|button|cta/i;
  const MAX_TEXT = 8000;

  const clean = (text) => (text ?? '').replace(/\s+/g, ' ').trim();
  const unique = (items) => [...new Set(items.filter(Boolean))];
  const asArray = (value) => (Array.isArray(value) ? value : value ? [value] : []);
  const meta = (name) => document.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.content ?? '';

  function shown(element) {
    return element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden' &&
      !element.closest(EXCLUDED);
  }

  function texts(selector, limit, maxLength = 140) {
    return unique([...document.querySelectorAll(selector)]
      .filter(shown)
      .map((element) => clean(element.innerText ?? element.value))
      .filter((text) => text.length >= 2 && text.length <= maxLength)).slice(0, limit);
  }

  function callsToAction() {
    const found = [...document.querySelectorAll('button, input[type="submit"], [role="button"], a')]
      .filter((element) => shown(element))
      .filter((element) => element.tagName !== 'A' || CTA_HINT.test(element.className?.baseVal ?? element.className ?? ''))
      .map((element) => clean(element.innerText ?? element.value))
      .filter((text) => text.length >= 2 && text.length <= 40);
    return unique(found).slice(0, 20);
  }

  function pageStructure() {
    const root = document.querySelector('main') ?? document.body;
    return [...root.children].filter(shown).slice(0, 15).map((element) => {
      const heading = element.querySelector('h1, h2, h3');
      const name = element.tagName.toLowerCase();
      return heading ? `${name}: ${clean(heading.innerText).slice(0, 60)}` : name;
    });
  }

  function toHex(color) {
    const parts = color.match(/[\d.]+/g)?.map(Number) ?? [];
    if (parts.length < 3 || parts[3] === 0) return '';
    return `#${parts.slice(0, 3).map((part) => Math.round(part).toString(16).padStart(2, '0')).join('')}`;
  }

  function palette() {
    const elements = [document.body, ...document.querySelectorAll('header, h1, button, a[class*="btn" i], a[class*="button" i], footer')]
      .filter(Boolean).slice(0, 30);
    return unique(elements.flatMap((element) => {
      const style = getComputedStyle(element);
      return [toHex(style.backgroundColor), toHex(style.color)];
    })).slice(0, 8);
  }

  function fonts() {
    const elements = [document.body, document.querySelector('h1')].filter(Boolean);
    return unique(elements.map((element) => getComputedStyle(element).fontFamily.split(',')[0].replace(/["']/g, '').trim()));
  }

  function structuredData() {
    const found = { currency: '', shipsTo: [], addressCountry: '' };
    const visit = (node) => {
      if (Array.isArray(node)) return node.forEach(visit);
      if (!node || typeof node !== 'object') return undefined;
      if (typeof node.priceCurrency === 'string' && !found.currency) found.currency = node.priceCurrency;
      if (node.addressCountry) {
        const value = asArray(node.addressCountry)[0];
        const country = typeof value === 'string' ? value : value?.name ?? '';
        if (node['@type'] === 'PostalAddress' && !found.addressCountry) found.addressCountry = country;
        else if (node['@type'] !== 'PostalAddress') found.shipsTo.push(...asArray(node.addressCountry).map((item) => (typeof item === 'string' ? item : item?.name ?? '')));
      }
      Object.values(node).forEach(visit);
      return undefined;
    };
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        visit(JSON.parse(script.textContent));
      } catch {
        // Malformed JSON-LD is common. The other signals still work.
      }
    }
    return found;
  }

  const body = document.body?.innerText ?? '';
  const main = document.querySelector('main')?.innerText ?? '';
  const visibleText = clean(main.length > 400 ? main : body).slice(0, MAX_TEXT);
  const data = structuredData();
  const navigation = performance.getEntriesByType('navigation')[0];

  return {
    url: location.href.split('#')[0],
    title: clean(document.title).slice(0, 300),
    meta_description: clean(meta('description') || meta('og:description')).slice(0, 600),
    lang: (document.documentElement.lang ?? '').slice(0, 20),
    headings: texts('h1, h2, h3', 20),
    cta_texts: callsToAction(),
    nav_labels: texts('nav a', 20, 40),
    structure: pageStructure(),
    visible_text: visibleText,
    colors: palette(),
    fonts: fonts(),
    prices: unique((visibleText.match(PRICE) ?? []).map(clean)).slice(0, 8),
    currency: data.currency || meta('product:price:currency'),
    ships_to: unique(data.shipsTo).slice(0, 20),
    address_country: data.addressCountry,
    hreflang: unique([...document.querySelectorAll('link[rel="alternate"][hreflang]')].map((link) => link.hreflang)).slice(0, 40),
    og_locale: meta('og:locale').slice(0, 20),
    http_status: navigation?.responseStatus ?? 0,
    challenge: CHALLENGE.test(document.title) || (body.length < 600 && CHALLENGE.test(body)),
  };
})();
