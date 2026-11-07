// Deterministic rules shared by the extension and the tests. No AI and no I/O here.

export const MARKETPLACE_DOMAINS = [
  'emag.ro', 'amazon.', 'ebay.', 'etsy.com', 'aliexpress.', 'temu.com',
  'okazii.ro', 'allegro.', 'trendyol.', 'walmart.com',
];

export const CHANGE_LABELS = {
  price: 'Preț',
  discount: 'Reducere',
  bundle_sample: 'Pachet sau mostră',
  shipping: 'Livrare',
  returns: 'Retur sau garanție',
  stock: 'Stoc',
  message: 'Mesaj principal',
};

export const CAPABILITY_LABELS = {
  samples: 'mostre',
  bundles: 'pachete',
  freeShipping: 'livrare gratuită',
};

const CURRENCIES = [
  [/\b(lei|ron)\b/i, 'RON'],
  [/€|\beur\b/i, 'EUR'],
  [/\$|\busd\b/i, 'USD'],
  [/£|\bgbp\b/i, 'GBP'],
];

export function normalizePrice(value, fallbackCurrency = null) {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? { amount: value, currency: fallbackCurrency } : null;
  }
  if (!value) return null;
  const text = String(value);
  const match = text.match(/(\d{1,3}(?:[.,\s]\d{3})+|\d+)(?:[.,](\d{1,2}))?(?!\d)/);
  if (!match) return null;
  const whole = match[1].replace(/[.,\s]/g, '');
  const amount = Number(`${whole}.${match[2] ?? '0'}`);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const found = CURRENCIES.find(([pattern]) => pattern.test(text));
  return { amount, currency: found ? found[1] : fallbackCurrency || null };
}

function formatPrice(price) {
  return price ? `${price.amount}${price.currency ? ` ${price.currency}` : ''}` : null;
}

export function makeSnapshot(raw, capturedAt = null) {
  const product = raw.product ?? {};
  let status = 'ok';
  if (raw.httpStatus === 404 || raw.httpStatus === 410 || raw.loadFailed) status = 'unavailable';
  if ([401, 403, 429, 503].includes(raw.httpStatus) || raw.challenge) status = 'blocked';
  return {
    url: raw.url,
    title: raw.title ?? '',
    capturedAt,
    status,
    lang: (raw.lang ?? '').slice(0, 2).toLowerCase(),
    shipsTo: raw.shipsTo ?? [],
    sellerMentions: raw.sellerMentions ?? 0,
    product: {
      name: product.name ?? '',
      category: product.category ?? '',
      description: product.description ?? '',
      availability: product.availability ?? '',
      price: normalizePrice(product.price, product.currency),
    },
    offers: [...new Set((raw.offers ?? []).map((text) => text.trim()).filter(Boolean))],
  };
}

function stem(word) {
  return word.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').slice(0, 6);
}

function tokens(text) {
  return new Set((text.match(/\p{L}{4,}/gu) ?? []).map(stem));
}

function sameProductType(snapshot, own) {
  const theirs = snapshot.product.category;
  if (theirs && own.category) return stem(theirs) === stem(own.category);
  const ownTokens = tokens(own.name);
  return [...tokens(snapshot.product.name)].some((token) => ownTokens.has(token));
}

function isMarketplace(snapshot) {
  let host = '';
  try {
    host = new URL(snapshot.url).hostname;
  } catch {
    return false;
  }
  return snapshot.sellerMentions >= 2 || MARKETPLACE_DOMAINS.some((domain) => host.includes(domain));
}

function criterion(name, state, evidence) {
  return { criterion: name, state, evidence };
}

export function classifyCandidate(snapshot, own) {
  const price = snapshot.product.price;
  const ownPrice = own.price;
  const market = own.market ?? {};
  const typeOk = sameProductType(snapshot, own);
  const reasons = [
    criterion('tip de produs', typeOk ? 'ok' : 'fail',
      snapshot.product.category || snapshot.product.name || 'necitit'),
  ];

  let priceState = 'unknown';
  if (price && ownPrice && price.currency === ownPrice.currency) {
    const ratio = price.amount / ownPrice.amount;
    priceState = ratio >= 0.5 && ratio <= 1.5 ? 'ok' : 'fail';
  }
  reasons.push(criterion('preț', priceState, formatPrice(price) ?? 'necitit'));

  let currencyState = 'unknown';
  if (price?.currency && ownPrice?.currency) {
    currencyState = price.currency === ownPrice.currency ? 'ok' : 'fail';
  }
  reasons.push(criterion('monedă', currencyState, price?.currency ?? 'necitită'));

  let langState = 'unknown';
  if (snapshot.lang && market.lang) langState = snapshot.lang === market.lang ? 'ok' : 'fail';
  reasons.push(criterion('limbă', langState, snapshot.lang || 'necitită'));

  let shipsState = 'unknown';
  if (snapshot.shipsTo.length && market.country) {
    shipsState = snapshot.shipsTo.includes(market.country) ? 'ok' : 'fail';
  }
  reasons.push(criterion('livrare în piața ta', shipsState, snapshot.shipsTo.join(', ') || 'necitită'));

  let status = 'rival';
  if (isMarketplace(snapshot)) status = 'marketplace';
  else if (!typeOk) status = 'not_comparable';
  else if ([currencyState, langState, shipsState].includes('fail')) status = 'other_market';
  else if ([currencyState, langState, priceState].includes('unknown')) status = 'unconfirmed_market';
  else if (priceState === 'fail') status = 'not_comparable';
  return { status, reasons };
}

export function classifyOffer(text) {
  if (/most[răa]|sample|discovery|descoperire|\bpachet|\bbundle|\bset\b/i.test(text)) return 'bundle_sample';
  if (/livrare|transport|shipping|delivery/i.test(text)) return 'shipping';
  if (/retur|garan[tțţ]|return|guarantee|money.?back/i.test(text)) return 'returns';
  if (/reducere|discount|\d+\s?%|promo|\bcod\b|coupon/i.test(text)) return 'discount';
  if (/\bstoc\b|in stock/i.test(text)) return 'stock';
  return 'message';
}

function offerKey(text) {
  return text
    .toLowerCase()
    .replace(/\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?/g, '')
    .replace(/\d+:\d+(?::\d+)?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function change(type, key, before, after, url) {
  return { id: `${type}|${key}`, type, before, after, url };
}

export function diffSnapshots(previous, next) {
  const changes = [];
  const unread = [];
  if (next.status !== 'ok') return { changes, unread, status: next.status };
  const before = previous.product;
  const after = next.product;

  if (before.price && !after.price) {
    unread.push('preț');
  } else if (before.price && after.price &&
    (before.price.amount !== after.price.amount || before.price.currency !== after.price.currency)) {
    const text = formatPrice(after.price);
    changes.push(change('price', text, formatPrice(before.price), text, next.url));
  }

  if (before.availability && !after.availability) {
    unread.push('stoc');
  } else if (before.availability && after.availability !== before.availability) {
    changes.push(change('stock', after.availability, before.availability, after.availability, next.url));
  }

  if (before.description && after.description && before.description !== after.description) {
    changes.push(change('message', after.description, before.description, after.description, next.url));
  }

  if (previous.offers.length && !next.offers.length) {
    unread.push('ofertă');
  } else {
    const oldOffers = new Map(previous.offers.map((text) => [offerKey(text), text]));
    const newOffers = new Map(next.offers.map((text) => [offerKey(text), text]));
    for (const [key, text] of newOffers) {
      if (!oldOffers.has(key)) changes.push(change(classifyOffer(text), key, null, text, next.url));
    }
    for (const [key, text] of oldOffers) {
      if (!newOffers.has(key)) changes.push(change(classifyOffer(text), `gone:${key}`, text, null, next.url));
    }
  }
  return { changes, unread, status: 'ok' };
}

export function createRivalState(snapshot, now) {
  const ok = snapshot.status === 'ok';
  return {
    url: snapshot.url,
    baseline: ok ? snapshot : null,
    pending: [],
    confirmed: [],
    unread: [],
    lastStatus: snapshot.status,
    lastCheckedAt: now,
    lastOkAt: ok ? now : null,
  };
}

export function trackRival(state, snapshot, now) {
  const next = { ...state, lastStatus: snapshot.status, lastCheckedAt: now };
  if (snapshot.status !== 'ok') return next;
  next.lastOkAt = now;
  if (!state.baseline) return { ...next, baseline: snapshot, unread: [] };

  const { changes, unread } = diffSnapshots(state.baseline, snapshot);
  const known = new Set(state.confirmed.map((item) => item.id));
  const pendingById = new Map(state.pending.map((item) => [item.id, item]));
  const pending = [];
  const confirmed = [...state.confirmed];
  for (const item of changes) {
    if (known.has(item.id)) continue;
    const seen = pendingById.get(item.id);
    if (seen) confirmed.push({ ...seen, state: 'confirmed', confirmedAt: now });
    else pending.push({ ...item, state: 'to_confirm', firstSeenAt: now });
  }
  return {
    ...next,
    pending,
    confirmed,
    unread,
    baseline: pending.length || unread.length ? state.baseline : snapshot,
  };
}

export function checkExperiment(experiment, capabilities, evidenceIds) {
  const errors = [];
  for (const need of experiment.requires ?? []) {
    if (!capabilities[need]) {
      errors.push(`Cere ${CAPABILITY_LABELS[need] ?? need}, pe care nu le-ai declarat.`);
    }
  }
  const discount = experiment.discountPct ?? 0;
  if (discount > (capabilities.maxDiscountPct ?? 0)) {
    errors.push(`Reducerea de ${discount}% depășește limita ta de ${capabilities.maxDiscountPct ?? 0}%.`);
  }
  const claims = experiment.claims ?? [];
  if (!claims.length) errors.push('Experimentul nu are nicio afirmație cu dovadă.');
  for (const claim of claims) {
    if (!evidenceIds.includes(claim.evidenceId)) {
      errors.push(`Afirmație fără dovadă salvată: „${claim.text}”.`);
    }
  }
  return { ok: errors.length === 0, errors };
}

const MAX_TEST_WEEKS = 6;

export function estimateTestDuration({ sessionsPerMonth, conversionRate, minimumLift = 0.25 }) {
  if (!(sessionsPerMonth > 0) || !(conversionRate > 0) || conversionRate >= 1) return null;
  const delta = conversionRate * minimumLift;
  const perVariant = Math.ceil((16 * conversionRate * (1 - conversionRate)) / (delta * delta));
  const weeks = Math.ceil(((2 * perVariant) / sessionsPerMonth) * (30 / 7));
  return { perVariant, weeks, tooLong: weeks > MAX_TEST_WEEKS };
}
