import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePrice,
  makeSnapshot,
  diffSnapshots,
  createRivalState,
  trackRival,
  checkExperiment,
  estimateTestDuration,
} from '../extension/lib/rules.js';

const page = (over = {}) => ({
  url: 'https://rival.ro/parfum',
  title: 'Parfum Rival',
  lang: 'ro',
  httpStatus: 200,
  challenge: false,
  shipsTo: ['RO'],
  product: { name: 'Parfum Oud 50 ml', category: 'Parfumuri', price: '320 lei', currency: 'RON', description: 'Note lemnoase', availability: 'InStock' },
  offers: ['Livrare gratuită peste 200 lei'],
  ...over,
});

test('normalizePrice reads Romanian, European and US formats', () => {
  assert.deepEqual(normalizePrice('1.299,00 lei'), { amount: 1299, currency: 'RON' });
  assert.deepEqual(normalizePrice('349 RON'), { amount: 349, currency: 'RON' });
  assert.deepEqual(normalizePrice('€49.90'), { amount: 49.9, currency: 'EUR' });
  assert.deepEqual(normalizePrice('$1,299.50'), { amount: 1299.5, currency: 'USD' });
  assert.deepEqual(normalizePrice(349, 'RON'), { amount: 349, currency: 'RON' });
  assert.equal(normalizePrice('la cerere'), null);
  assert.equal(normalizePrice(''), null);
});

test('makeSnapshot marks blocked and unavailable pages', () => {
  assert.equal(makeSnapshot(page({ httpStatus: 403 })).status, 'blocked');
  assert.equal(makeSnapshot(page({ challenge: true })).status, 'blocked');
  assert.equal(makeSnapshot(page({ httpStatus: 404 })).status, 'unavailable');
  assert.equal(makeSnapshot(page()).status, 'ok');
});

test('a new sample offer is detected with before, after and source', () => {
  const before = makeSnapshot(page());
  const after = makeSnapshot(page({ offers: ['Livrare gratuită peste 200 lei', 'Set de 3 mostre la 39 lei'] }));
  const { changes } = diffSnapshots(before, after);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].type, 'bundle_sample');
  assert.equal(changes[0].before, null);
  assert.equal(changes[0].after, 'Set de 3 mostre la 39 lei');
  assert.equal(changes[0].url, after.url);
});

test('an unread price is reported as unread, never as a change', () => {
  const before = makeSnapshot(page());
  const after = makeSnapshot(page({ product: { ...page().product, price: '' } }));
  const d = diffSnapshots(before, after);
  assert.deepEqual(d.changes, []);
  assert.deepEqual(d.unread, ['price']);
});

test('offers missing while the whole offer zone is unread are not removals', () => {
  const before = makeSnapshot(page());
  const after = makeSnapshot(page({ offers: [] }));
  const d = diffSnapshots(before, after);
  assert.deepEqual(d.changes, []);
  assert.deepEqual(d.unread, ['offer']);
});

test('dates and countdowns inside an offer are noise', () => {
  const before = makeSnapshot(page({ offers: ['Promoție valabilă până la 12.11.2026'] }));
  const after = makeSnapshot(page({ offers: ['Promoție valabilă până la 19.11.2026'] }));
  assert.deepEqual(diffSnapshots(before, after).changes, []);
});

test('a price change is detected', () => {
  const after = makeSnapshot(page({ product: { ...page().product, price: '289 lei' } }));
  const { changes } = diffSnapshots(makeSnapshot(page()), after);
  assert.equal(changes[0].type, 'price');
  assert.equal(changes[0].before, '320 RON');
  assert.equal(changes[0].after, '289 RON');
});

test('a change needs two observations to be confirmed', () => {
  const sample = ['Livrare gratuită peste 200 lei', 'Set de 3 mostre la 39 lei'];
  let s = createRivalState(makeSnapshot(page()), 't0');
  s = trackRival(s, makeSnapshot(page({ offers: sample })), 't1');
  assert.equal(s.pending.length, 1);
  assert.equal(s.confirmed.length, 0);
  s = trackRival(s, makeSnapshot(page({ offers: sample })), 't2');
  assert.equal(s.pending.length, 0);
  assert.equal(s.confirmed.length, 1);
  assert.equal(s.confirmed[0].confirmedAt, 't2');
  s = trackRival(s, makeSnapshot(page({ offers: sample })), 't3');
  assert.equal(s.confirmed.length, 1);
});

test('a change seen once and gone is dropped', () => {
  let s = createRivalState(makeSnapshot(page()), 't0');
  s = trackRival(s, makeSnapshot(page({ offers: ['Livrare gratuită peste 200 lei', 'Banner de o zi cu reducere 10%'] })), 't1');
  s = trackRival(s, makeSnapshot(page()), 't2');
  assert.equal(s.pending.length, 0);
  assert.equal(s.confirmed.length, 0);
});

test('a blocked check keeps data and the last good date', () => {
  const sample = ['Livrare gratuită peste 200 lei', 'Set de 3 mostre'];
  let s = createRivalState(makeSnapshot(page()), 't0');
  s = trackRival(s, makeSnapshot(page({ offers: sample })), 't1');
  s = trackRival(s, makeSnapshot(page({ httpStatus: 403 })), 't2');
  assert.equal(s.lastStatus, 'blocked');
  assert.equal(s.lastOkAt, 't1');
  assert.equal(s.pending.length, 1);
  assert.equal(s.confirmed.length, 0);
});

test('a first capture that was blocked gets a baseline later', () => {
  let s = createRivalState(makeSnapshot(page({ httpStatus: 403 })), 't0');
  assert.equal(s.baseline, null);
  s = trackRival(s, makeSnapshot(page()), 't1');
  assert.ok(s.baseline);
  assert.equal(s.pending.length, 0);
});

const caps = { samples: true, bundles: false, freeShipping: false, maxDiscountPct: 10 };
const evidence = ['e1'];

test('an experiment within capabilities and with evidence passes', () => {
  const r = checkExperiment({ requires: ['samples'], discountPct: 5, claims: [{ text: 'x', evidenceId: 'e1' }] }, caps, evidence);
  assert.deepEqual(r, { ok: true, errors: [] });
});

test('an undeclared capability is rejected', () => {
  const r = checkExperiment({ requires: ['bundles'], discountPct: 0, claims: [{ text: 'x', evidenceId: 'e1' }] }, caps, evidence);
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /bundles/);
});

test('a discount above the limit is rejected', () => {
  const r = checkExperiment({ requires: [], discountPct: 20, claims: [{ text: 'x', evidenceId: 'e1' }] }, caps, evidence);
  assert.equal(r.ok, false);
  assert.match(r.errors[0], /20%/);
});

test('a claim without saved evidence is rejected', () => {
  const r = checkExperiment({ requires: [], discountPct: 0, claims: [{ text: 'x', evidenceId: 'nu-exista' }] }, caps, evidence);
  assert.equal(r.ok, false);
});

test('an experiment with no claims is rejected', () => {
  assert.equal(checkExperiment({ requires: [], discountPct: 0, claims: [] }, caps, evidence).ok, false);
});

test('test duration matches the reference order of magnitude', () => {
  const d = estimateTestDuration({ sessionsPerMonth: 4000, conversionRate: 0.03 });
  assert.ok(d.perVariant > 7500 && d.perVariant < 9000);
  assert.equal(d.tooLong, true);
  assert.equal(estimateTestDuration({ sessionsPerMonth: 0, conversionRate: 0.03 }), null);
  assert.equal(estimateTestDuration({ sessionsPerMonth: 100000, conversionRate: 0.03 }).tooLong, false);
});
