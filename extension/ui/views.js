import { CHANGE_LABELS } from '../lib/rules.js';
import { icon } from './icons.js';
import { APPEARANCES } from './theme.js';

export const TABS = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'market', label: 'Market', icon: 'market' },
  { id: 'changes', label: 'Changes', icon: 'changes' },
  { id: 'tests', label: 'Tests', icon: 'tests' },
];

const RIVAL_STATUS = {
  blocked: ['Blocked', 'bad', 'lock'],
  unavailable: ['Page unavailable', 'bad', 'alert'],
};

const CHANGE_TILES = {
  price: 'tile-orange',
  discount: 'tile-orange',
  bundle_sample: 'tile-lilac',
  shipping: 'tile-chart',
  returns: 'tile-yellow',
  stock: 'tile-blue',
  message: 'tile-chat',
};

const STEP_STATES = {
  pending: ['clock', 'Waiting'],
  running: ['', 'Working'],
  done: ['check', 'Done'],
  failed: ['close', 'Failed'],
  skipped: ['minus', 'Skipped'],
};

const ANALYSIS_STATUS = {
  queued: ['Waiting', '', 'clock'],
  running: ['Working', '', 'clock'],
  done: ['Ready', 'ok', 'check'],
  partial: ['Partial result', 'warn', 'alert'],
  failed: ['Failed', 'bad', 'close'],
  expired: ['Expired', 'warn', 'clock'],
};

const CATEGORY_LABELS = { direct: 'Direct', indirect: 'Indirect', visual_reference: 'Visual' };

const CATEGORY_CHIPS = [
  { id: 'direct', label: 'Direct', tone: 'aqua' },
  { id: 'indirect', label: 'Indirect', tone: 'pink' },
  { id: 'visual_reference', label: 'Visual', tone: 'orange' },
];

const FINISHED = new Set(['done', 'partial', 'failed', 'expired']);

export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

export const when = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
}) : 'never');

export const safeUrl = (url) => (/^https?:\/\//.test(url) ? esc(url) : '#');

export const host = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

const dataLabel = (url) => (/^https?:\/\/(localhost|127\.0\.0\.1)/.test(url) ? 'SIMULATED' : 'LIVE');

export const pill = (text, kind = '', iconName = '') =>
  `<span class="pill ${kind}">${iconName ? icon(iconName) : ''}${esc(text)}</span>`;

export const external = (url, text) =>
  `<a class="link" href="${safeUrl(url)}" target="_blank" rel="noreferrer"><span>${esc(text)}</span>${icon('link')}</a>`;

export const object3d = (name, className = '') =>
  `<img class="${className}" src="assets/3d/${name}.webp" alt="" width="420" height="420" draggable="false">`;

export function primaryButton(ui, { action, label, kind = 'primary', iconName, data = {}, disabled = false }) {
  const attrs = Object.entries(data).map(([key, value]) => `data-${key}="${esc(value)}"`).join(' ');
  const loading = ui.busy === action;
  return `<button type="button" class="btn ${kind}" data-action="${action}" ${attrs}
    ${disabled || ui.busy ? 'disabled' : ''} ${loading ? 'aria-busy="true"' : ''}>
    ${loading ? '<span class="spinner" aria-hidden="true"></span>' : iconName ? icon(iconName) : ''}<span>${esc(label)}</span>
  </button>`;
}

export function stageView() {
  return `<div class="stage" aria-hidden="true">
    ${object3d('mascot', 'stage-mascot')}
    ${object3d('tile-chart', 'stage-float float-a')}
    ${object3d('tile-doc', 'stage-float float-b')}
    ${object3d('tile-dots', 'stage-float float-c')}
    ${object3d('tile-chat', 'stage-float float-d')}
    <span class="stage-plus plus-a">${icon('plus')}</span>
    <span class="stage-plus plus-b">${icon('plus')}</span>
    <span class="stage-plus plus-c">${icon('plus')}</span>
  </div>`;
}

export function aquaCard(title) {
  return `<section class="aqua-card"><h1>${esc(title)}</h1>${object3d('lens', 'aqua-object')}</section>`;
}

export function miniTiles() {
  return `<div class="mini-tiles" aria-hidden="true">
    ${['tile-orange', 'tile-blue', 'tile-yellow', 'tile-lilac'].map((name) => object3d(name)).join('')}
  </div>`;
}

export function lilacHero(object, compact = false) {
  return `<section class="hero" aria-hidden="true">
    ${object3d('cloud', 'hero-cloud cloud-c')}
    ${object3d(object, `hero-object ${compact ? 'compact' : ''}`)}
    ${object3d('cloud', 'hero-cloud cloud-a')}
    ${object3d('cloud', 'hero-cloud cloud-b')}
  </section>`;
}

export function tileCard({ tile, title, value = '', sub = '', attrs = '' }) {
  return `<button type="button" class="tcard" ${attrs}>
    ${object3d(tile, 'tile-object')}
    <strong>${esc(title)}</strong>
    ${sub ? `<span class="sub">${esc(sub)}</span>` : ''}
    ${value ? `<span class="price">${esc(value)}</span>` : ''}
  </button>`;
}

export function chipButton({ id, label, tone }, selected, attribute) {
  return `<button type="button" class="chip ${tone}" data-${attribute}="${esc(id)}" aria-pressed="${id === selected}">${esc(label)}</button>`;
}

export function emptyState(title, body) {
  return `<div class="empty">
    ${object3d('bot', 'empty-object')}
    <h2>${esc(title)}</h2><p>${esc(body)}</p></div>`;
}

export function section(title, rows, footer = '') {
  return `<section class="section">
    ${title ? `<h2 class="section-title">${esc(title)}</h2>` : ''}
    <div class="group">${rows}</div>
    ${footer ? `<p class="section-footer">${esc(footer)}</p>` : ''}
  </section>`;
}

export function chevronRow({ action, title, sub = '', iconName, tone = '', value = '', data = {} }) {
  const attrs = Object.entries(data).map(([key, item]) => `data-${key}="${esc(item)}"`).join(' ');
  return `<button type="button" class="row-button" data-action="${action}" ${attrs}>
    ${iconName ? `<span class="tile ${tone}">${icon(iconName)}</span>` : ''}
    <span class="row-main"><strong>${esc(title)}</strong>${sub ? `<span class="sub">${esc(sub)}</span>` : ''}</span>
    ${value ? `<span class="row-value">${esc(value)}</span>` : ''}
    <span class="row-chevron">${icon('chevron')}</span>
  </button>`;
}

export function avatar(title) {
  const letter = (title || '?').trim().charAt(0).toUpperCase();
  return `<span class="avatar" aria-hidden="true">${esc(letter)}</span>`;
}

export function segmented(items, selected, attribute, label) {
  const buttons = items.map((item) => `<button type="button" data-${attribute}="${esc(item.id)}"
    aria-pressed="${item.id === selected}">${esc(item.label)}</button>`).join('');
  return `<div class="segmented" role="group" aria-label="${esc(label)}">${buttons}</div>`;
}

export function sheetFrame(title, body, actions = '') {
  return `<button type="button" class="grabber" aria-label="Drag to resize or close"></button>
    <header class="sheet-head">
      <h2 id="sheet-title">${esc(title)}</h2>
      <button type="button" class="text-button" data-action="close-sheet">Done</button>
    </header>
    <div class="sheet-body">${body}</div>
    ${actions ? `<div class="sheet-actions">${actions}</div>` : ''}`;
}

export function stepsView(steps) {
  const rows = steps.map((step) => {
    const [iconName, text] = STEP_STATES[step.state] ?? STEP_STATES.pending;
    const mark = iconName ? icon(iconName) : '<span class="spinner" aria-hidden="true"></span>';
    return `<li class="step ${esc(step.state)}">${mark}
      <span class="step-text"><span>${esc(step.label)}</span>
      <span class="sub">${esc(step.detail || text)}</span></span></li>`;
  }).join('');
  return `<ol class="steps">${rows}</ol>`;
}

export const analysisPill = (status) => {
  const [text, kind, iconName] = ANALYSIS_STATUS[status] ?? [status, '', ''];
  return pill(text, kind, iconName);
};

export function analysisCard(analysis) {
  if (!analysis) return '<div id="analysis-card"></div>';
  const notes = (analysis.errors ?? []).map((error) =>
    `<p class="banner">${icon('alert')}<span>${esc(error.message)}</span></p>`).join('');
  const running = !FINISHED.has(analysis.status);
  if (!running && !notes) return '<div id="analysis-card"></div>';
  return `<section id="analysis-card" aria-live="polite">${notes}${running ? stepsView(analysis.steps ?? []) : ''}</section>`;
}

const isFinishedAnalysis = (analysis) => Boolean(analysis) && FINISHED.has(analysis.status);
const isTracked = (state, candidate) => state.rivals.some((rival) => rival.source === candidate.url);
const pendingCount = (state) => state.candidates.filter((item) => item.selected && !isTracked(state, item)).length;

// Which screen of the reference picture this tab follows.
export function lookOf(state, ui) {
  if (ui.tab === 'market' || ui.tab === 'tests') return 'right';
  if (ui.tab === 'home' && !isFinishedAnalysis(state.analysis)) return 'violet';
  return 'left';
}

export function primaryAction(state, ui) {
  const { analysis } = state;
  const running = analysis && !isFinishedAnalysis(analysis);
  const main = running
    ? { action: 'open-report', label: 'View progress', icon: 'report', waiting: false }
    : { action: 'analyze', label: 'Analyze the site in this tab', icon: 'market', waiting: !analysis };
  if (ui.tab === 'market' && pendingCount(state)) {
    return { action: 'track', label: `Track selected (${pendingCount(state)})`, icon: 'check', waiting: true };
  }
  if (ui.tab === 'changes' && state.rivals.length) {
    return { action: 'check', label: 'Check now', icon: 'refresh', waiting: false };
  }
  return main;
}

export function topLeftAction(state, ui) {
  if (ui.tab === 'home' && isFinishedAnalysis(state.analysis)) {
    return { action: 'open-report', label: 'View report', icon: 'report' };
  }
  return { action: 'open-offer', label: 'Your offer', icon: 'grid' };
}

export function matchesFilter(item, ui) {
  const category = item.category ?? 'direct';
  if (ui.chip && category !== ui.chip) return false;
  return !ui.query || item.title.toLowerCase().includes(ui.query.trim().toLowerCase());
}

function offerSummary(caps) {
  const count = ['samples', 'bundles', 'freeShipping'].filter((name) => caps[name]).length;
  return `${count} of 3 on`;
}

function countChanges(state) {
  return state.rivals.reduce((sum, rival) => sum + rival.pending.length + rival.confirmed.length, 0);
}

function homeStart(state) {
  const { analysis } = state;
  const running = Boolean(analysis);
  const text = running ? '' : 'We find your competitors, compare them and show you what to change. Tap the round button to start.';
  return `<div class="stage-space"></div>
    ${aquaCard(running ? 'Analyzing your website' : 'Analyze your website')}
    <div class="on-violet">
      ${running ? `<div class="pills center top-gap">${analysisPill(analysis.status)}${analysis.label ? pill(analysis.label) : ''}</div>` : ''}
      ${running ? analysisCard(analysis) : `<p class="lede">${text}</p>`}
    </div>
    ${running ? '' : miniTiles()}`;
}

function homeDone(state) {
  const { analysis, own } = state;
  const sub = analysis.status === 'expired'
    ? 'Your saved report is still available. Open it with the top left button. The round button analyzes the site in this tab.'
    : 'Your report is ready. Open it with the top left button. The round button analyzes the site in this tab.';
  const cards = [
    tileCard({ tile: 'tile-orange', title: 'Competitors', value: `${state.candidates.length} found`, attrs: 'data-tab="market"' }),
    tileCard({ tile: 'tile-blue', title: 'Changes', value: `${countChanges(state)} to review`, attrs: 'data-tab="changes"' }),
    tileCard({ tile: 'tile-yellow', title: 'Tests', value: `${state.approved.length} approved`, attrs: 'data-tab="tests"' }),
    tileCard({ tile: 'tile-lilac', title: 'Your offer', value: offerSummary(state.capabilities), attrs: 'data-action="open-offer"' }),
  ].join('');
  return `${lilacHero('rocket')}
    <h1 class="screen-title">${esc(own?.name || host(analysis.url))}</h1>
    <p class="screen-sub">${esc(sub)}</p>
    ${analysisCard(analysis)}
    <div class="stagger">${cards}</div>`;
}

function homeView(state) {
  return isFinishedAnalysis(state.analysis) ? homeDone(state) : homeStart(state);
}

function competitorCard(state, item, index, ui) {
  const tone = index % 2 ? 'aqua' : 'violet';
  const tile = index % 2 ? 'tile-yellow' : 'tile-lilac';
  const category = CATEGORY_LABELS[item.category] ?? 'Direct';
  const hidden = matchesFilter(item, ui) ? '' : ' hidden';
  const body = `${object3d(tile, 'tile-object')}<strong>${esc(item.title)}</strong>`;
  if (isTracked(state, item)) {
    return `<article class="pcard ${tone}" data-card="${index}"${hidden}>${body}
      <span class="pcard-note">${esc(category)} · Tracking</span></article>`;
  }
  return `<label class="pcard ${tone}" data-card="${index}"${hidden}>
    <input class="visually-hidden" type="checkbox" role="switch" data-select="${index}" ${item.selected ? 'checked' : ''} aria-label="Track ${esc(item.title)}">
    ${body}<span class="pcard-note">${esc(category)} · ${item.selected ? 'Selected' : 'Tap to select'}</span></label>`;
}

function marketView(state, ui) {
  const title = '<h1 class="big-title">Competitors<br>For You</h1>';
  if (!state.candidates.length) return `${title}${emptyState('No competitors yet', 'Tap the round button to analyze your website.')}`;
  const pending = pendingCount(state);
  const hint = pending ? `${pending} selected. Tap the round button to track them.` : 'All selected competitors are tracked.';
  return `${title}
    <label class="search">${icon('market')}<span class="visually-hidden">Search competitors</span>
      <input type="search" data-query placeholder="Search" value="${esc(ui.query)}" autocomplete="off"></label>
    <div class="chips" role="group" aria-label="Filter by type">
      ${CATEGORY_CHIPS.map((chip) => chipButton(chip, ui.chip, 'chip')).join('')}
    </div>
    <button type="button" class="see-more" data-action="open-report">see more</button>
    ${state.discoveryLabel ? `<div class="pills spaced">${pill(state.discoveryLabel)}</div>` : ''}
    <p class="screen-sub">${esc(hint)}</p>
    <div class="overlap">${state.candidates.map((item, index) => competitorCard(state, item, index, ui)).join('')}</div>`;
}

function changeCard(change, rival, rivalIndex) {
  const confirmed = change.state === 'confirmed';
  return tileCard({
    tile: CHANGE_TILES[change.type] ?? 'tile-chat',
    title: CHANGE_LABELS[change.type] ?? change.type,
    sub: `${rival.title} · ${dataLabel(change.url)}`,
    value: confirmed ? 'Confirmed' : 'To confirm',
    attrs: `data-action="open-change" data-rival="${esc(rivalIndex)}" data-change="${esc(change.id)}"`,
  });
}

function rivalIssue(rival) {
  if (rival.lastStatus === 'ok' && !rival.unread.length) return '';
  const status = RIVAL_STATUS[rival.lastStatus];
  const pillHtml = status ? pill(...status) : pill('Incomplete data', 'warn', 'alert');
  const unread = rival.unread.length ? `Not read: ${rival.unread.join(', ')}. ` : '';
  return `<div class="row">${avatar(rival.title)}
    <div class="row-main"><strong>${esc(rival.title)}</strong>
    <span class="sub">${esc(unread)}Last good check: ${esc(when(rival.lastOkAt))}.</span>
    ${external(rival.url, 'Open and check by hand')}</div>${pillHtml}</div>`;
}

function changesView(state) {
  const head = `${lilacHero('bell', true)}<h1 class="screen-title">What changed</h1>`;
  if (!state.rivals.length) {
    return `${head}<p class="screen-sub">Track a competitor to start.</p>
      ${emptyState('Nothing tracked yet', 'Choose competitors in Market.')}`;
  }
  const last = state.rivals.map((rival) => rival.lastCheckedAt).sort().at(-1);
  const cards = state.rivals.flatMap((rival, index) => [...rival.confirmed, ...rival.pending]
    .map((change) => changeCard(change, rival, index))).join('');
  const issues = state.rivals.map(rivalIssue).join('');
  return `${head}
    <p class="screen-sub">Last check: ${esc(when(last))}. Tap the round button to check now.</p>
    ${cards ? `<div class="stagger">${cards}</div>
      <p class="section-footer">A change is confirmed at the second check. It is a signal to investigate.</p>`
    : emptyState('No changes yet', 'A change is confirmed at the second check.')}
    ${issues ? section('Needs attention', issues) : ''}`;
}

function testCard(item, index) {
  const tone = index % 2 ? 'aqua' : 'violet';
  return `<button type="button" class="pcard ${tone}" data-action="open-share" data-index="${index}">
    ${object3d(index % 2 ? 'tile-lilac' : 'tile-yellow', 'tile-object')}
    <strong>${esc(item.headline)}</strong><span class="pcard-note">Tap to share</span></button>`;
}

function testsView(state) {
  const title = '<h1 class="big-title">Approved<br>Tests</h1>';
  if (!state.approved.length) return `${title}${emptyState('No tests yet', 'Start from a change in Changes.')}`;
  return `${title}<p class="screen-sub">Nothing was published to your store.</p>
    <div class="overlap">${state.approved.map(testCard).join('')}</div>`;
}

const VIEWS = { home: homeView, market: marketView, changes: changesView, tests: testsView };

export function tabView(state, ui) {
  return VIEWS[ui.tab](state, ui);
}

export const titleOf = (tab) => TABS.find((item) => item.id === tab)?.label ?? '';

function tabButton(tab, ui, badges) {
  return `<button type="button" data-tab="${tab.id}" aria-label="${tab.label}" title="${tab.label}" ${tab.id === ui.tab ? 'aria-current="page"' : ''}>
    ${icon(tab.icon)}
    ${badges[tab.id] ? `<span class="badge" aria-label="${badges[tab.id]} items">${badges[tab.id]}</span>` : ''}
  </button>`;
}

export function tabBarView(state, ui) {
  const badges = { changes: countChanges(state), tests: state.approved.length };
  const primary = primaryAction(state, ui);
  const loading = ui.busy === primary.action;
  const fab = `<button type="button" class="fab ${primary.waiting && !ui.busy ? 'waiting' : ''}" data-action="${primary.action}"
    aria-label="${esc(primary.label)}" title="${esc(primary.label)}" ${ui.busy ? 'disabled' : ''} ${loading ? 'aria-busy="true"' : ''}>
    ${loading ? '<span class="spinner" aria-hidden="true"></span>' : icon(primary.icon)}</button>`;
  return `${TABS.slice(0, 2).map((tab) => tabButton(tab, ui, badges)).join('')}${fab}
    ${TABS.slice(2).map((tab) => tabButton(tab, ui, badges)).join('')}`;
}

function switchRow(caps, name, label, iconName, tone) {
  return `<label class="row"><span class="tile ${tone}">${icon(iconName)}</span>
    <span class="row-main">${label}</span>
    <input class="switch" type="checkbox" role="switch" data-cap="${name}" ${caps[name] ? 'checked' : ''}></label>`;
}

function numberRow(caps, name, label, unit = '') {
  return `<label class="row"><span class="row-main">${label}</span>
    <input type="number" min="0" inputmode="decimal" data-cap="${name}" value="${esc(caps[name])}" placeholder="0">
    ${unit ? `<span class="unit">${unit}</span>` : ''}</label>`;
}

function offerSheet(state) {
  const caps = state.capabilities;
  return sheetFrame('Your offer', `
    ${section('', `${switchRow(caps, 'samples', 'Samples', 'gift', 'pink')}
      ${switchRow(caps, 'bundles', 'Bundles', 'box', 'orange')}
      ${switchRow(caps, 'freeShipping', 'Free shipping', 'truck', 'aqua')}
      ${numberRow(caps, 'maxDiscountPct', 'Maximum discount', '%')}`, 'Tests only use what you turn on here.')}
    ${section('Traffic', `${numberRow(caps, 'sessionsPerMonth', 'Sessions per month')}
      ${numberRow(caps, 'conversionPct', 'Conversion', '%')}`, 'Optional. Used to estimate how long a test takes.')}`);
}

function connectionRow(title, state, detail) {
  const kinds = { ok: ['Online', 'ok'], off: ['Offline', 'bad'], unknown: ['Checking', ''] };
  const [text, kind] = kinds[state] ?? kinds.unknown;
  return `<div class="row"><span class="row-main"><strong>${esc(title)}</strong>
    ${detail ? `<span class="sub">${esc(detail)}</span>` : ''}</span>${pill(text, kind)}</div>`;
}

function settingsSheet(ui) {
  const { connection } = ui;
  return sheetFrame('Settings', `
    <h2 class="section-title">Appearance</h2>
    ${segmented(APPEARANCES, ui.appearance, 'appearance', 'Appearance')}
    ${section('Connection', `${connectionRow('Analysis server', connection.analysis, connection.analysisDetail)}
      ${connectionRow('Demo server', connection.demo, connection.demoDetail)}`)}
    ${section('', `<button type="button" class="row-button destructive" data-action="reset">
      ${ui.confirmReset ? 'Tap again to erase everything' : 'Reset all data'}</button>`)}`);
}

function changeSheet(state, ui) {
  const rival = state.rivals[ui.sheet.rival];
  const change = rival && [...rival.pending, ...rival.confirmed].find((item) => item.id === ui.sheet.change);
  if (!change) return sheetFrame('Change', '<p>This change is no longer available.</p>');
  const confirmed = change.state === 'confirmed';
  return sheetFrame(CHANGE_LABELS[change.type] ?? change.type, `
    <div class="pills">
      ${confirmed ? pill('Confirmed', 'ok', 'check') : pill('To confirm', 'warn', 'clock')}
      ${pill(dataLabel(change.url))}
    </div>
    <dl class="diff">
      <div class="before"><dt>Before</dt><dd>${esc(change.before ?? 'Nothing')}</dd></div>
      <div class="after"><dt>After</dt><dd>${esc(change.after ?? 'Removed')}</dd></div>
    </dl>
    <p class="meta">${esc(rival.title)} · ${esc(when(change.confirmedAt ?? change.firstSeenAt))}</p>
    <p>${external(change.url, host(change.url))}</p>`,
  primaryButton(ui, { action: 'propose', label: 'Propose a test', data: { rival: ui.sheet.rival, change: change.id } }));
}

function factRow(label, value) {
  return `<div class="row"><span class="row-main"><span class="sub">${esc(label)}</span><span>${esc(value)}</span></span></div>`;
}

function experimentSheet(state, ui) {
  const draft = state.draft;
  const blocked = !draft.check.ok;
  const duration = draft.duration
    ? `${draft.duration.weeks} weeks, ${draft.duration.perVariant} visitors per variant`
    : 'Add sessions and conversion in Your offer.';
  const evidence = (draft.claims ?? []).map((claim) => {
    const source = draft.evidence.find((item) => item.id === claim.evidenceId);
    return `<div class="source"><span class="source-quote">${esc(claim.text)}</span>
      ${source ? external(source.url, host(source.url)) : ''}</div>`;
  }).join('');
  const actions = blocked
    ? primaryButton(ui, { action: 'fix-caps', label: 'Change your offer' })
    : `${primaryButton(ui, { action: 'approve', label: 'Approve', iconName: 'check' })}
       ${primaryButton(ui, { action: 'preview', label: draft.previewing ? 'Hide from my page' : 'Show on my page', kind: 'secondary', iconName: 'eye' })}`;
  return sheetFrame('Proposed test', `
    <div class="pills">${pill(draft.label)}${blocked ? pill('Rejected by your rules', 'bad', 'close') : pill('Passes your rules', 'ok', 'check')}</div>
    ${draft.check.errors.map((error) => `<p class="banner">${icon('alert')}<span>${esc(error)}</span></p>`).join('')}
    <div class="variant"><strong>${esc(draft.headline)}</strong><p>${esc(draft.body)}</p>
      <span class="variant-cta">${esc(draft.cta)}</span></div>
    <p>${esc(draft.hypothesis)}</p>
    ${draft.duration?.tooLong ? `<p class="banner">${icon('clock')}<span>This test takes over six weeks. Choose a bigger change or a before/after test, with its limits.</span></p>` : ''}
    ${section('Measurement', `${factRow('Primary metric', draft.primaryMetric)}${factRow('Guardrail metric', draft.guardrailMetric)}
      ${factRow('Duration', duration)}${factRow('Stop if', draft.stopCondition)}`)}
    ${section('Sources', evidence, 'A signal to investigate. It does not show that a rival sold more.')}`, actions);
}

function shareSheet(state, ui) {
  const item = state.approved[ui.sheet.index];
  if (!item) return sheetFrame('Share', '<p>This test is no longer available.</p>');
  return sheetFrame('Share', section('', `
    ${chevronRow({ action: 'brief', title: 'Test brief', sub: 'Markdown file', iconName: 'doc', tone: 'aqua', data: { index: ui.sheet.index } })}
    ${chevronRow({ action: 'block', title: 'Page block', sub: 'HTML file', iconName: 'code', tone: 'pink', data: { index: ui.sheet.index } })}
    ${chevronRow({ action: 'visual', title: 'Visual for Adobe Express', sub: 'PNG file', iconName: 'image', tone: 'orange', data: { index: ui.sheet.index } })}`));
}

export function sheetView(state, ui) {
  const views = {
    offer: () => offerSheet(state),
    settings: () => settingsSheet(ui),
    change: () => changeSheet(state, ui),
    experiment: () => experimentSheet(state, ui),
    share: () => shareSheet(state, ui),
  };
  return views[ui.sheet.name]();
}
