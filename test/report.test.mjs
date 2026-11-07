import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import {
  competitorSheet, recommendationSheet, reportView, skippedSheet, sourcesSheet,
} from '../extension/ui/report.js';
import {
  analysisCard, lookOf, matchesFilter, primaryAction, tabBarView, TABS, tabView, topLeftAction,
} from '../extension/ui/views.js';
import { DEFAULT_APPEARANCE, resolveTheme } from '../extension/ui/theme.js';
import { experimentMode, isDemoUrl } from '../server/simulated.mjs';

const fixture = JSON.parse(readFileSync(new URL('../backend/fixtures/demo_result.json', import.meta.url), 'utf8'));

function job(overrides = {}) {
  return {
    job_id: 'j1',
    status: 'done',
    label: 'SIMULATED',
    created_at: '2026-11-07T12:00:00+00:00',
    updated_at: '2026-11-07T12:00:00+00:00',
    steps: [{ id: 'profile', label: 'Reading your website', state: 'done', detail: '' }],
    result: structuredClone(fixture),
    usage: { calls: 0, input_tokens: 0, output_tokens: 0, estimated_cost_usd: 0 },
    errors: [],
    warnings: [],
    ...overrides,
  };
}

const emptyState = (extra = {}) => ({
  own: null, capabilities: { samples: false, bundles: false, freeShipping: false },
  analysis: null, candidates: [], discoveryLabel: null, rivals: [], draft: null, approved: [], ...extra,
});

const ui = (extra = {}) => ({ tab: 'home', busy: null, chip: null, query: '', ...extra });
const finished = { jobId: 'j', url: 'https://a.ro/', status: 'done', label: 'LIVE', steps: [], errors: [] };
const running = { ...finished, status: 'running' };
const candidate = (extra = {}) => ({ url: 'https://r.ro/', title: 'Rival', why: 'x', selected: true, category: 'direct', ...extra });

test('the SIMULATED label is visible on simulated reports', () => {
  assert.match(reportView(job()), /SIMULATED/);
});

test('the report is built as three phones, one for each section', () => {
  const html = reportView(job(), { section: 'competitors' });
  assert.equal((html.match(/class="phone/g) ?? []).length, 3);
  assert.match(html, /class="phone current"[^>]*data-section="competitors"/);
  assert.match(html, /Target market/);
  assert.match(html, /Casa de Parfum/);
  assert.match(html, /For You/);
});

test('removed report content stays removed', () => {
  const html = reportView(job());
  for (const text of ['swatch', 'Page structure', 'How the analysis went', 'All evidence', 'class="cite"']) {
    assert.ok(!html.includes(text), text);
  }
});

test('competitor details open in a sheet, with a real outside link', () => {
  const html = competitorSheet(job(), 0);
  assert.match(html, /href="http:\/\/localhost:8787\/demo\/rival-a" target="_blank" rel="noreferrer"/);
  assert.match(html, /Positioning/);
});

test('text from websites is escaped', () => {
  const data = job();
  data.result.competitors[0].why_relevant = '<img src=x onerror=alert(1)>';
  data.result.competitors[0].name = '"><script>alert(1)</script>';
  for (const html of [reportView(data), competitorSheet(data, 0)]) {
    assert.ok(!html.includes('<img src=x'));
    assert.ok(!html.includes('<script>alert'));
  }
});

test('a javascript URL never becomes a link', () => {
  const data = job();
  data.result.competitors[0].url = 'javascript:alert(1)';
  assert.ok(!competitorSheet(data, 0).includes('href="javascript:'));
});

test('only real JPEG data URLs reach the page', () => {
  const data = job();
  data.result.competitors[0].screenshot_data_url = 'https://tracker.example/pixel.gif';
  assert.ok(!competitorSheet(data, 0).includes('tracker.example'));
});

test('zero competitors are shown as zero, with the reason', () => {
  const data = job({ status: 'partial', errors: [{ code: 'no_competitors', stage: 'report', message: 'We verified 0 competitors.' }] });
  data.result.competitors = [];
  data.result.recommendations = [];
  const html = reportView(data);
  assert.match(html, /No verified competitors/);
  assert.match(html, /We verified 0 competitors/);
});

test('a running job shows progress and that the panel may close', () => {
  const data = job({ status: 'running' });
  data.result = { competitors: [], skipped: [], recommendations: [], evidence: [], candidates_found: 0 };
  const html = reportView(data);
  assert.match(html, /You can close the panel/);
  assert.match(html, /class="steps"/);
});

test('recommendation details keep the hypothesis and the signal caveat', () => {
  const html = recommendationSheet(job(), 0);
  assert.match(html, /Hypothesis to test/);
  assert.match(reportView(job()), /signal to investigate/);
});

test('recommendations can be filtered by priority', () => {
  const html = reportView(job(), { priority: 'low' });
  assert.match(html, /free shipping threshold is lower/);
  assert.ok(!html.includes('does not help someone'));
  assert.match(reportView(job()), /does not help someone/);
});

test('every source button opens real saved evidence', () => {
  const data = job();
  const html = [
    reportView(data),
    ...data.result.competitors.map((_, index) => competitorSheet(data, index)),
    ...data.result.recommendations.map((_, index) => recommendationSheet(data, index)),
  ].join('');
  const chips = [...html.matchAll(/data-ids="([^"]+)"/g)].map((match) => match[1].split(','));
  assert.ok(chips.length);
  for (const ids of chips) {
    const sheet = sourcesSheet(data, ids);
    assert.ok(!sheet.includes('No saved source'), ids.join());
    assert.match(sheet, /class="source-quote"/);
  }
});

test('blocked sites show the Blocked label, not a guess', () => {
  assert.match(skippedSheet(job()), /Blocked/);
});

test('the real cost appears only when there was one', () => {
  assert.ok(!reportView(job()).includes('cost about'));
  const paid = job({ usage: { calls: 3, input_tokens: 1, output_tokens: 1, estimated_cost_usd: 0.0712 } });
  assert.match(reportView(paid), /cost about \$0\.07/);
});

test('the bottom bar has four tabs around one round button', () => {
  const html = tabBarView(emptyState(), ui());
  assert.equal(TABS.length, 4);
  assert.equal((html.match(/data-tab=/g) ?? []).length, 4);
  assert.equal((html.match(/class="fab/g) ?? []).length, 1);
});

test('every tab keeps a name for screen readers', () => {
  const html = tabBarView(emptyState(), ui());
  for (const tab of TABS) assert.match(html, new RegExp(`aria-label="${tab.label}"`));
});

test('the round button always has a job', () => {
  const state = (extra) => emptyState(extra);
  assert.equal(primaryAction(state(), ui()).action, 'analyze');
  assert.equal(primaryAction(state({ analysis: running }), ui()).label, 'View progress');
  assert.equal(primaryAction(state({ analysis: running }), ui()).action, 'open-report');
  assert.equal(primaryAction(state({ analysis: finished }), ui()).action, 'analyze');
  assert.equal(primaryAction(state({ analysis: finished }), ui({ tab: 'tests' })).action, 'analyze');
  assert.equal(primaryAction(state(), ui({ tab: 'changes' })).action, 'analyze');
  const rival = { source: 'https://x.ro/', pending: [], confirmed: [], unread: [], lastStatus: 'ok' };
  assert.equal(primaryAction(state({ analysis: finished, rivals: [rival] }), ui({ tab: 'changes' })).action, 'check');
});

test('the round button tracks only while something waits to be tracked', () => {
  const pending = emptyState({ analysis: finished, candidates: [candidate()] });
  const action = primaryAction(pending, ui({ tab: 'market' }));
  assert.equal(action.action, 'track');
  assert.equal(action.label, 'Track selected (1)');
  assert.equal(action.waiting, true);
  const done = { ...pending, rivals: [{ source: 'https://r.ro/', pending: [], confirmed: [], unread: [] }] };
  assert.equal(primaryAction(done, ui({ tab: 'market' })).action, 'analyze');
});

test('no screen repeats the action of the round button in a big button', () => {
  for (const tab of TABS) {
    const html = tabView(emptyState({ analysis: finished, candidates: [candidate()] }), ui({ tab: tab.id }));
    assert.ok(!html.includes('class="btn '), tab.id);
  }
});

test('each screen follows its model from the reference picture', () => {
  assert.equal(lookOf(emptyState(), ui()), 'violet');
  assert.equal(lookOf(emptyState({ analysis: running }), ui()), 'violet');
  assert.equal(lookOf(emptyState({ analysis: finished }), ui()), 'left');
  assert.equal(lookOf(emptyState({ analysis: { ...finished, status: 'expired' } }), ui()), 'left');
  assert.equal(lookOf(emptyState(), ui({ tab: 'changes' })), 'left');
  assert.equal(lookOf(emptyState(), ui({ tab: 'market' })), 'right');
  assert.equal(lookOf(emptyState(), ui({ tab: 'tests' })), 'right');
});

test('the top left square never repeats a card on the same screen', () => {
  assert.equal(topLeftAction(emptyState({ analysis: finished }), ui()).action, 'open-report');
  assert.equal(topLeftAction(emptyState(), ui()).action, 'open-offer');
  assert.equal(topLeftAction(emptyState({ analysis: finished }), ui({ tab: 'market' })).action, 'open-offer');
});

test('market filters by category and by name', () => {
  const direct = candidate({ title: 'Casa de Parfum' });
  const indirect = candidate({ title: 'Nota', category: 'indirect' });
  assert.ok(matchesFilter(direct, ui()));
  assert.ok(matchesFilter(direct, ui({ chip: 'direct' })));
  assert.ok(!matchesFilter(indirect, ui({ chip: 'direct' })));
  assert.ok(matchesFilter(direct, ui({ query: 'casa' })));
  assert.ok(!matchesFilter(direct, ui({ query: 'nota' })));
  assert.ok(matchesFilter(candidate({ category: undefined }), ui({ chip: 'direct' })));
});

test('market shows filtered cards as hidden, so typing never rebuilds the screen', () => {
  const state = emptyState({ analysis: finished, candidates: [candidate(), candidate({ category: 'indirect', title: 'B' })] });
  const html = tabView(state, ui({ tab: 'market', chip: 'indirect' }));
  assert.equal((html.match(/data-card="/g) ?? []).length, 2);
  assert.equal((html.match(/ hidden/g) ?? []).length, 1);
});

test('competitor cards stay real switches for keyboard and screen readers', () => {
  const html = tabView(emptyState({ candidates: [candidate()] }), ui({ tab: 'market' }));
  assert.match(html, /type="checkbox" role="switch" data-select="0"/);
});

test('removed buttons stay removed', () => {
  const own = { url: 'https://a.ro/', name: 'A' };
  const html = TABS.map((tab) => tabView(emptyState({ own, analysis: finished }), ui({ tab: tab.id }))).join('');
  for (const action of ['read-own', 'discover', 'read-candidates']) {
    assert.ok(!html.includes(`data-action="${action}"`), action);
  }
});

test('a finished analysis needs no progress list in the panel', () => {
  const analysis = { ...finished, steps: [{ id: 'x', label: 'y', state: 'done' }] };
  assert.ok(!analysisCard(analysis).includes('class="steps"'));
});

test('the app starts in Light and ignores a dark system until asked', () => {
  assert.equal(DEFAULT_APPEARANCE, 'light');
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme(undefined, true), 'light');
  assert.equal(resolveTheme('dark', false), 'dark');
  assert.equal(resolveTheme('system', true), 'dark');
  assert.equal(resolveTheme('system', false), 'light');
});

test('no Romanian text remains in the extension interface', () => {
  const dir = new URL('../extension/', import.meta.url);
  const files = ['panel.html', 'results.html', 'panel.js', 'results.js', 'ui/views.js', 'ui/report.js', 'lib/rules.js', 'lib/analysis.js'];
  for (const file of files) {
    const text = readFileSync(new URL(file, dir), 'utf8');
    assert.ok(!/[ăâîșțĂÂÎȘȚ]/.test(text.replace(/\/.*?\/i?[,.)]/g, '')), file);
  }
  assert.ok(readdirSync(dir).includes('app.css'));
  for (const page of ['panel.html', 'results.html']) {
    const html = readFileSync(new URL(page, dir), 'utf8');
    assert.ok(!html.includes('panel.css') && !html.includes('report.css'), page);
  }
});

test('every 3D object the interface asks for exists', () => {
  const assets = new Set(readdirSync(new URL('../extension/assets/3d/', import.meta.url)));
  const views = ['ui/views.js', 'ui/report.js']
    .map((file) => readFileSync(new URL(`../extension/${file}`, import.meta.url), 'utf8')).join('');
  const names = new Set([...views.matchAll(/'(tile-(?:orange|blue|yellow|lilac|chart|chat|doc|dots)|mascot|rocket|cloud|lens|bell|bot)'/g)].map((match) => match[1]));
  assert.ok(names.size >= 12);
  for (const name of names) assert.ok(assets.has(`${name}.webp`), name);
});

test('only local addresses count as the demo', () => {
  assert.ok(isDemoUrl('http://localhost:8787/demo/shop'));
  assert.ok(isDemoUrl('http://127.0.0.1:8787/x'));
  assert.ok(!isDemoUrl('https://localhost.evil.example/'));
  assert.ok(!isDemoUrl('https://shop.ro/'));
  assert.ok(!isDemoUrl(undefined));
});

test('experiments on real evidence never fall back to simulation', () => {
  assert.equal(experimentMode([{ url: 'https://rival.ro/' }], false), 'unavailable');
  assert.equal(experimentMode([{ url: 'http://localhost:8787/demo/rival-a' }], false), 'simulated');
  assert.equal(experimentMode([{ url: 'https://rival.ro/' }], true), 'live');
});
