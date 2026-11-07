// Pure views for the results page: job state in, HTML out.
// Three phones, as in the reference picture. Narrow windows show one at a time.

import { icon } from './icons.js';
import {
  analysisPill, aquaCard, avatar, chevronRow, chipButton, emptyState, esc, external, host, lilacHero,
  object3d, pill, primaryButton, safeUrl, section, sheetFrame, stageView, stepsView, tileCard, when,
} from './views.js';

const COMPETITOR_TYPES = {
  direct: ['Direct', 'ok'],
  indirect: ['Indirect', 'warn'],
  visual_reference: ['Visual reference', ''],
};

const COMPETITOR_MARKETS = {
  confirmed: ['Market confirmed', 'ok', 'check'],
  unconfirmed: ['Market unconfirmed', 'warn', 'alert'],
};

const SKIPPED = {
  blocked: ['Blocked', 'bad', 'lock'],
  unavailable: ['Page unavailable', 'bad', 'alert'],
  robots: ['Disallowed by robots.txt', 'warn', 'lock'],
  unsafe: ['Forbidden address', 'bad', 'shield'],
  failed: ['Did not load', 'warn', 'alert'],
  not_competitor: ['Not comparable', 'warn', 'close'],
  other_market: ['Other market', 'warn', 'market'],
  unverified: ['Not verified', 'warn', 'alert'],
};

const MARKET_STATUS = {
  detected: ['Inferred', 'ok', 'check'],
  unconfirmed: ['Market unconfirmed', 'warn', 'alert'],
  corrected: ['Corrected by you', 'ok', 'check'],
  unknown: ['Unknown', 'warn', 'alert'],
};

const PRIORITIES = {
  high: ['High priority', 'bad'],
  medium: ['Medium priority', 'warn'],
  low: ['Low priority', ''],
};

export const SECTIONS = [
  { id: 'overview', label: 'Overview', tone: 'aqua' },
  { id: 'competitors', label: 'Competitors', tone: 'pink' },
  { id: 'actions', label: 'Actions', tone: 'orange' },
];

const PRIORITY_CHIPS = [
  { id: 'high', label: 'High', tone: 'aqua' },
  { id: 'medium', label: 'Medium', tone: 'pink' },
  { id: 'low', label: 'Low', tone: 'orange' },
];

const COMPETITOR_TILES = ['tile-orange', 'tile-blue', 'tile-yellow'];

const COUNTRIES = [
  'AT', 'AU', 'BE', 'BG', 'BR', 'CA', 'CH', 'CZ', 'DE', 'DK', 'ES', 'FI', 'FR', 'GB', 'GR', 'HU', 'IE',
  'IN', 'IT', 'JP', 'MD', 'MX', 'NL', 'NO', 'NZ', 'PL', 'PT', 'RO', 'SE', 'SK', 'TR', 'US',
];
const LANGUAGES = ['bg', 'cs', 'da', 'de', 'el', 'en', 'es', 'fi', 'fr', 'hu', 'it', 'ja', 'nl', 'no', 'pl', 'pt', 'ro', 'sk', 'sv', 'tr'];

const SAFE_IMAGE = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;

const labelled = (table, key) => {
  const [text, kind, iconName] = table[key] ?? [key, '', ''];
  return pill(text, kind, iconName);
};

function displayName(type, code) {
  if (!code) return '';
  try {
    return new Intl.DisplayNames(['en'], { type }).of(code) ?? code;
  } catch {
    return code;
  }
}

function selectRow(id, label, codes, type, selected, emptyLabel) {
  const list = selected && !codes.includes(selected) ? [selected, ...codes] : codes;
  const options = list
    .map((code) => ({ code, name: displayName(type, code) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'))
    .map(({ code, name }) => `<option value="${esc(code)}" ${code === selected ? 'selected' : ''}>${esc(name)}</option>`)
    .join('');
  const placeholder = selected ? '' : `<option value="" selected>${esc(emptyLabel)}</option>`;
  return `<label class="row"><span class="row-main">${esc(label)}</span>
    <select id="${id}">${placeholder}${options}</select></label>`;
}

function sourcesChip(ids) {
  if (!ids?.length) return '';
  const text = ids.length === 1 ? '1 source' : `${ids.length} sources`;
  return `<button type="button" class="sources-chip" data-action="open-sources" data-ids="${esc(ids.join(','))}">
    ${esc(text)}${icon('chevron')}</button>`;
}

function fact(label, value) {
  return `<p><span class="field-label">${esc(label)}</span>${esc(value)}</p>`;
}

function inferredRow(label, field) {
  const known = field && field.status !== 'unknown' && field.value;
  return `<div class="row"><span class="row-main"><span class="sub">${esc(label)}</span>
    <span>${esc(known ? field.value : 'Not read')}</span></span>${known ? pill('Inferred') : ''}</div>`;
}

function marketSection(market, busy) {
  if (!market) return '';
  const name = displayName('region', market.country_code) || 'Unknown';
  return `${section('Target market', `
    <div class="row"><span class="row-main"><strong>${esc(name)}</strong>
      <span class="sub">${esc(market.note)}</span></span>${labelled(MARKET_STATUS, market.status)}</div>
    ${selectRow('market-country', 'Country', COUNTRIES, 'region', market.country_code, 'Choose a country')}
    ${selectRow('market-language', 'Language', LANGUAGES, 'language', market.language, 'Choose a language')}`)}
    <div class="section">${primaryButton({ busy: busy ? 'rerun' : null }, { action: 'rerun', label: 'Update market', kind: 'secondary' })}</div>`;
}

function notices(job, notice) {
  const items = [notice, ...job.errors.map((error) => error.message), ...job.warnings].filter(Boolean);
  return items.map((text) => `<p class="banner" role="alert">${icon('alert')}<span>${esc(text)}</span></p>`).join('');
}

function costNote(job) {
  const cost = job.usage?.estimated_cost_usd ?? 0;
  return cost > 0 ? `<p class="cost-note">This analysis cost about $${cost.toFixed(2)} in AI usage.</p>` : '';
}

function overviewPhone(job, { notice, busy, finished }) {
  const { result } = job;
  const { profile, gap_summary: gap } = result;
  const about = profile ? section('Your website', `
    ${inferredRow('Category', profile.category)}
    ${inferredRow('Value proposition', profile.value_proposition)}
    ${inferredRow('Audience', profile.target_audience)}`,
  'Inferred means our reading of your page, not a verified fact.') : '';
  const title = gap ? 'Your main opportunity' : finished ? 'Your market' : 'Analyzing your website';
  return `${stageView()}
    <div class="scroller"><div class="stage-space"></div>
      ${aquaCard(title)}
      <div class="on-violet">
        <div class="pills center top-gap">${pill(job.label, job.label === 'LIVE' ? 'ok' : 'warn')}${analysisPill(job.status)}</div>
        ${gap ? `<p class="lede">${esc(gap.text)}</p><div class="sources-row">${sourcesChip(gap.evidence_ids)}</div>` : ''}
        ${finished ? '' : `<div aria-live="polite">${stepsView(job.steps)}</div>
          <p class="lede">You can close the panel. The analysis keeps running.</p>`}
        ${notices(job, notice)}
        ${marketSection(result.market, busy)}
        ${about}
        ${finished ? costNote(job) : ''}
      </div>
    </div>`;
}

function competitorsPhone(job, finished) {
  const { competitors, skipped, candidates_found: found } = job.result;
  const cards = competitors.map((item, index) => tileCard({
    tile: COMPETITOR_TILES[index % COMPETITOR_TILES.length],
    title: item.name,
    value: (COMPETITOR_TYPES[item.category] ?? [item.category])[0],
    attrs: `data-action="open-competitor" data-index="${index}"`,
  })).join('');
  const empty = finished
    ? emptyState('No verified competitors', 'We do not invent competitors.')
    : emptyState('Still looking', 'Competitors appear here when they are verified.');
  const summary = found ? `${competitors.length} verified from ${found} candidates found automatically.` : '';
  return `<div class="scroller">
      ${lilacHero('rocket')}
      <h2 class="screen-title">Your Competitors</h2>
      ${summary ? `<p class="screen-sub">${esc(summary)}</p>` : ''}
      <div class="pills spaced">${pill(job.label, job.label === 'LIVE' ? 'ok' : 'warn')}</div>
      ${competitors.length ? `<div class="stagger">${cards}</div>` : empty}
      ${skipped.length ? section('', chevronRow({ action: 'open-skipped', title: 'Sites we left out', iconName: 'alert', tone: 'yellow', value: String(skipped.length) })) : ''}
    </div>
    <div class="report-bar"><button type="button" class="fab" data-action="open-panel" aria-label="Open the side panel" title="Open the side panel">${icon('market')}</button></div>`;
}

function actionCard(item, index) {
  const tone = index % 2 ? 'aqua' : 'violet';
  return `<button type="button" class="pcard ${tone}" data-action="open-recommendation" data-index="${index}">
    ${object3d(index % 2 ? 'tile-yellow' : 'tile-lilac', 'tile-object')}
    <strong>${esc(item.problem)}</strong>
    <span class="pcard-note">${esc(PRIORITIES[item.priority]?.[0] ?? item.priority)}</span></button>`;
}

function actionsPhone(job, finished, priority) {
  const { recommendations, profile } = job.result;
  const shown = recommendations
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !priority || item.priority === priority);
  const cards = shown.map(({ item, index }) => actionCard(item, index)).join('');
  const empty = !recommendations.length
    ? (finished
      ? emptyState('No recommendations', 'We only write them when saved evidence exists.')
      : emptyState('Still writing', 'Recommendations appear when the report is ready.'))
    : emptyState('Nothing here', 'No recommendation has this priority.');
  const openSite = profile
    ? `<a class="fab" href="${safeUrl(profile.url)}" target="_blank" rel="noreferrer" aria-label="Open your website" title="Open your website">${icon('link')}</a>`
    : '';
  return `<div class="scroller">
      <h2 class="big-title">Actions<br>For You</h2>
      <div class="chips" role="group" aria-label="Filter by priority">
        ${PRIORITY_CHIPS.map((chip) => chipButton(chip, priority, 'priority')).join('')}
      </div>
      <div class="pills spaced top-gap">${pill(job.label, job.label === 'LIVE' ? 'ok' : 'warn')}</div>
      ${shown.length ? `<div class="overlap">${cards}</div>` : empty}
      ${recommendations.length ? '<p class="section-footer">What you see at a competitor is a signal to investigate, not proof that its sales grew.</p>' : ''}
    </div>
    <div class="report-bar">${openSite}</div>`;
}

export function missingView(message) {
  return `<section class="phone current" data-look="violet" data-section="overview">${stageView()}
    <div class="scroller"><div class="stage-space"></div>${aquaCard('Report unavailable')}
      <div class="on-violet"><p class="lede">${esc(message)}</p></div></div></section>`;
}

export function reportNavView(current) {
  return SECTIONS.map((item) => chipButton(item, current, 'section')).join('');
}

function phone(section, look, current, html) {
  return `<section class="phone${section === current ? ' current' : ''}" data-look="${look}" data-section="${section}" aria-label="${esc(section)}">${html}</section>`;
}

export function reportView(job, { notice = '', section: current = 'overview', busy = false, priority = null } = {}) {
  const finished = ['done', 'partial', 'failed'].includes(job.status);
  return `${phone('competitors', 'left', current, competitorsPhone(job, finished))}
    ${phone('overview', 'violet', current, overviewPhone(job, { notice, busy, finished }))}
    ${phone('actions', 'right', current, actionsPhone(job, finished, priority))}`;
}

export function competitorSheet(job, index) {
  const item = job.result.competitors[index];
  if (!item) return sheetFrame('Competitor', '<p>This competitor is no longer available.</p>');
  const shot = SAFE_IMAGE.test(item.screenshot_data_url ?? '')
    ? `<img class="shot" src="${item.screenshot_data_url}" alt="First screen of ${esc(item.name)}">`
    : '';
  const ids = [...new Set([...item.evidence_ids, ...(item.positioning?.evidence_ids ?? []), ...(item.visual?.evidence_ids ?? [])])];
  return sheetFrame(item.name, `
    ${shot}
    <div class="pills">${labelled(COMPETITOR_TYPES, item.category)}${labelled(COMPETITOR_MARKETS, item.market_status)}</div>
    <p>${external(item.url, host(item.url))}</p>
    <p>${esc(item.why_relevant)}</p>
    ${item.positioning ? fact('Positioning', item.positioning.text) : ''}
    ${item.visual ? fact('Look and feel', item.visual.text) : ''}
    ${sourcesChip(ids)}`);
}

export function recommendationSheet(job, index) {
  const item = job.result.recommendations[index];
  if (!item) return sheetFrame('Action', '<p>This recommendation is no longer available.</p>');
  const example = item.example_headline || item.example_cta
    ? `<div class="variant">
      ${item.example_headline ? `<strong>${esc(item.example_headline)}</strong>` : ''}
      ${item.example_cta ? `<span class="variant-cta">${esc(item.example_cta)}</span>` : ''}</div>`
    : '';
  const assumptions = item.assumptions.length
    ? `<p><span class="field-label">Check first</span>${item.assumptions.map(esc).join(' ')}</p>`
    : '';
  return sheetFrame('Recommended action', `
    <div class="pills">${labelled(PRIORITIES, item.priority)}</div>
    <p><strong>${esc(item.problem)}</strong></p>
    ${fact('What to change', item.website_change)}
    ${example}
    ${fact('Hypothesis to test', item.expected_benefit_hypothesis)}
    ${assumptions}
    ${sourcesChip(item.evidence_ids)}`);
}

export function sourcesSheet(job, ids) {
  const rows = ids.map((id) => job.result.evidence.find((item) => item.id === id)).filter(Boolean)
    .map((item) => `<div class="source">
      <span class="source-quote">${esc(item.quote)}</span>
      <span class="sub">${esc(item.field)} · ${esc(when(item.captured_at))}</span>
      ${external(item.url, host(item.url))}</div>`).join('');
  return sheetFrame('Sources', section('', rows || '<div class="source">No saved source.</div>'));
}

export function skippedSheet(job) {
  const rows = job.result.skipped.map((item) => `<div class="row">${avatar(item.domain)}
    <div class="row-main"><strong>${esc(item.domain)}</strong><span class="sub">${esc(item.reason)}</span></div>
    ${labelled(SKIPPED, item.status)}</div>`).join('');
  return sheetFrame('Sites we left out', section('', rows));
}
