// Deterministic rules shared by the extension and the tests. No AI and no I/O here.

export const CHANGE_LABELS = {
  price: 'Price',
  discount: 'Discount',
  bundle_sample: 'Bundle or sample',
  shipping: 'Shipping',
  returns: 'Returns or warranty',
  stock: 'Stock',
  message: 'Main message',
};

export const CAPABILITY_LABELS = {
  samples: 'samples',
  bundles: 'bundles',
  freeShipping: 'free shipping',
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
    unread.push('price');
  } else if (before.price && after.price &&
    (before.price.amount !== after.price.amount || before.price.currency !== after.price.currency)) {
    const text = formatPrice(after.price);
    changes.push(change('price', text, formatPrice(before.price), text, next.url));
  }

  if (before.availability && !after.availability) {
    unread.push('stock');
  } else if (before.availability && after.availability !== before.availability) {
    changes.push(change('stock', after.availability, before.availability, after.availability, next.url));
  }

  if (before.description && after.description && before.description !== after.description) {
    changes.push(change('message', after.description, before.description, after.description, next.url));
  }

  if (previous.offers.length && !next.offers.length) {
    unread.push('offer');
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
      errors.push(`It needs ${CAPABILITY_LABELS[need] ?? need}, which you have not declared.`);
    }
  }
  const discount = experiment.discountPct ?? 0;
  if (discount > (capabilities.maxDiscountPct ?? 0)) {
    errors.push(`A ${discount}% discount is above your ${capabilities.maxDiscountPct ?? 0}% limit.`);
  }
  const claims = experiment.claims ?? [];
  if (!claims.length) errors.push('This test has no claim backed by evidence.');
  for (const claim of claims) {
    if (!evidenceIds.includes(claim.evidenceId)) {
      errors.push(`Claim without saved evidence: "${claim.text}".`);
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
