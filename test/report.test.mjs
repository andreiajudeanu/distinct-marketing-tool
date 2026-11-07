import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dockView, reportView } from '../extension/ui/report.js';
import { discoveryMode, experimentMode, isDemoUrl } from '../server/simulated.mjs';

const fixture = JSON.parse(readFileSync(new URL('../backend/fixtures/demo_result.json', import.meta.url), 'utf8'));

function job(overrides = {}) {
  return {
    job_id: 'j1',
    status: 'done',
    label: 'SIMULAT',
    created_at: '2026-11-07T12:00:00+00:00',
    updated_at: '2026-11-07T12:00:00+00:00',
    steps: [{ id: 'profile', label: 'Citesc site-ul tău', state: 'done', detail: '' }],
    result: structuredClone(fixture),
    errors: [],
    warnings: [],
    ...overrides,
  };
}

test('the SIMULAT label is visible on simulated reports', () => {
  assert.match(reportView(job()), /SIMULAT/);
});

test('the report shows every required section', () => {
  const html = reportView(job());
  for (const text of ['Rezumatul site-ului', 'Piața țintă', 'Competitori găsiți automat', 'Comparația mesajelor',
    'Observații vizuale', 'Trei recomandări prioritizate', 'Toate dovezile']) {
    assert.ok(html.includes(text), text);
  }
});

test('competitor links are clickable and open outside the extension', () => {
  const html = reportView(job());
  assert.match(html, /href="http:\/\/localhost:8787\/demo\/rival-a" target="_blank" rel="noreferrer"/);
});

test('text from websites is escaped', () => {
  const data = job();
  data.result.competitors[0].why_relevant = '<img src=x onerror=alert(1)>';
  data.result.competitors[0].name = '"><script>alert(1)</script>';
  const html = reportView(data);
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!html.includes('<script>alert'));
});

test('a javascript URL never becomes a link', () => {
  const data = job();
  data.result.competitors[0].url = 'javascript:alert(1)';
  assert.ok(!reportView(data).includes('href="javascript:'));
});

test('only real JPEG data URLs and hex colors reach the page', () => {
  const data = job();
  data.result.competitors[0].screenshot_data_url = 'https://tracker.example/pixel.gif';
  data.result.competitors[0].content.palette = ['red;background:url(https://tracker.example/x)', '#112233'];
  const html = reportView(data);
  assert.ok(!html.includes('tracker.example'));
  assert.ok(html.includes('background:#112233'));
});

test('a missing screenshot and missing price say Necitit-style text, not a guess', () => {
  const html = reportView(job());
  assert.match(html, /Captură necitită/);
  assert.match(html, /Necitit/);
});

test('zero competitors are shown as zero, with the reason', () => {
  const data = job({ status: 'partial', errors: [{ code: 'no_competitors', stage: 'verification', message: 'Am găsit 0 competitori verificați.' }] });
  data.result.competitors = [];
  data.result.recommendations = [];
  data.result.positioning = [];
  data.result.visual = [];
  const html = reportView(data);
  assert.match(html, /Niciun competitor verificat/);
  assert.match(html, /Am găsit 0 competitori verificați/);
});

test('a running job shows progress and that the panel may close', () => {
  const data = job({ status: 'running' });
  data.result = { competitors: [], skipped: [], positioning: [], visual: [], recommendations: [], evidence: [], candidates_found: 0 };
  const html = reportView(data);
  assert.match(html, /Progres/);
  assert.match(html, /Poți închide panoul/);
});

test('recommendations label the benefit as a hypothesis and keep the signal caveat', () => {
  const html = reportView(job());
  assert.match(html, /ipoteză de testat/);
  assert.match(html, /semnal de investigat/);
});

test('every recommendation citation points at an evidence row in the page', () => {
  const html = reportView(job());
  const cited = [...html.matchAll(/class="cite" href="#(e\d+)"/g)].map((match) => match[1]);
  assert.ok(cited.length);
  for (const id of cited) assert.ok(html.includes(`id="${id}"`), id);
});

test('the report dock has four sections around a central round button', () => {
  const html = dockView(job(), false, 0);
  assert.equal((html.match(/data-section=/g) ?? []).length, 4);
  assert.equal((html.match(/class="fab"/g) ?? []).length, 1);
});

test('the rerun button is disabled while a job runs', () => {
  assert.match(dockView(job({ status: 'running' }), false, 0), /class="fab"[^>]*disabled/);
});

test('only local addresses count as the demo', () => {
  assert.ok(isDemoUrl('http://localhost:8787/demo/shop'));
  assert.ok(isDemoUrl('http://127.0.0.1:8787/x'));
  assert.ok(!isDemoUrl('https://localhost.evil.example/'));
  assert.ok(!isDemoUrl('https://shop.ro/'));
  assert.ok(!isDemoUrl(undefined));
});

test('a real site never receives simulated rivals', () => {
  assert.equal(discoveryMode('https://shop.ro/', false), 'unavailable');
  assert.equal(discoveryMode('https://shop.ro/', true), 'live');
  assert.equal(discoveryMode('http://localhost:8787/demo/shop', true), 'simulated');
});

test('experiments on real evidence never fall back to simulation', () => {
  assert.equal(experimentMode([{ url: 'https://rival.ro/' }], false), 'unavailable');
  assert.equal(experimentMode([{ url: 'http://localhost:8787/demo/rival-a' }], false), 'simulated');
  assert.equal(experimentMode([{ url: 'https://rival.ro/' }], true), 'live');
});
