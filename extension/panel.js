import {
  checkExperiment,
  createRivalState,
  estimateTestDuration,
  makeSnapshot,
  trackRival,
} from './lib/rules.js';
import {
  BackendError, getAnalysis, getHealth, isFinished, JOB_KEY, POLL_MS, REPORT_KEY, startAnalysis,
} from './lib/analysis.js';
import { icon } from './ui/icons.js';
import { hideSheet, showSheet, watchSheetDrag } from './ui/sheet.js';
import { initTheme, saveAppearance } from './ui/theme.js';
import {
  analysisCard, esc, lookOf, matchesFilter, sheetView, stageView, tabBarView, tabView, titleOf,
  topLeftAction, when,
} from './ui/views.js';

const SERVER = 'http://localhost:8787';
const STATE_KEY = 'distinctWatch';
const STATE_VERSION = 2;
const PAGE_TIMEOUT_MS = 15000;
const SCREENSHOT_QUALITY = 60;
const FADE_MS = 220;

const app = document.getElementById('app');
const notice = document.getElementById('notice');
const tabbar = document.getElementById('tabbar');
const sheet = document.getElementById('sheet');
const scroller = document.getElementById('scroller');
const navTitle = document.getElementById('nav-title');
const phone = document.getElementById('phone');
const stage = document.getElementById('stage');
const topLeft = document.getElementById('top-left');

const emptyState = () => ({
  version: STATE_VERSION,
  own: null,
  capabilities: { samples: false, bundles: false, freeShipping: false, maxDiscountPct: 0, sessionsPerMonth: '', conversionPct: '' },
  analysis: null,
  appliedJob: null,
  candidates: [],
  discoveryLabel: null,
  rivals: [],
  draft: null,
  approved: [],
});

let state = emptyState();
const ui = {
  tab: 'home',
  busy: null,
  sheet: null,
  chip: null,
  query: '',
  appearance: 'light',
  confirmReset: false,
  connection: { analysis: 'unknown', analysisDetail: '', demo: 'unknown', demoDetail: '' },
};
let activeUrl = '';
let watchTimer;

async function save() {
  await chrome.storage.local.set({ [STATE_KEY]: state });
}

function showNotice(text) {
  notice.innerHTML = text ? `${icon('alert')}<span>${esc(text)}</span>` : '';
  notice.hidden = !text;
}

async function api(path, body) {
  let response;
  try {
    response = await fetch(`${SERVER}${path}`, body ? {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    } : undefined);
  } catch {
    throw new Error('The local server is not responding. Start it with npm start.');
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'The server returned an error.');
  return data;
}

async function extractFrom(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    files: ['lib/extract.js'],
  });
  return result;
}

function waitForLoad(tabId) {
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    };
    const listener = (id, info) => {
      if (id === tabId && info.status === 'complete') finish();
    };
    const timer = setTimeout(finish, PAGE_TIMEOUT_MS);
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === 'complete') finish();
    });
  });
}

async function readPage(url) {
  const now = new Date().toISOString();
  const tab = await chrome.tabs.create({ url, active: false });
  try {
    await waitForLoad(tab.id);
    return makeSnapshot(await extractFrom(tab.id), now);
  } catch {
    return makeSnapshot({ url, loadFailed: true }, now);
  } finally {
    await chrome.tabs.remove(tab.id).catch(() => {});
  }
}

const originPattern = (url) => `${new URL(url).origin}/*`;

function requestOrigins(urls) {
  return chrome.permissions.request({ origins: [...new Set(urls.map(originPattern))] });
}

async function readOwnPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!/^https?:/.test(tab?.url ?? '')) throw new Error('Open your website first.');
  const raw = await extractFrom(tab.id).catch(() => {
    throw new Error('We cannot read this page. Click the extension icon and try again.');
  });
  const snapshot = makeSnapshot(raw, new Date().toISOString());
  // Language and domain do not prove a market. Only a declared destination does.
  const country = snapshot.shipsTo.length === 1 ? snapshot.shipsTo[0] : '';
  state.own = {
    url: snapshot.url,
    name: snapshot.product.name,
    category: snapshot.product.category,
    priceAmount: snapshot.product.price?.amount ?? '',
    currency: snapshot.product.price?.currency ?? '',
    country,
    lang: snapshot.lang,
    offers: snapshot.offers,
  };
  return tab;
}

function ownForRules() {
  const own = state.own;
  return {
    url: own.url,
    name: own.name,
    category: own.category,
    price: own.priceAmount ? { amount: Number(own.priceAmount), currency: own.currency } : null,
    market: { country: own.country, lang: own.lang },
  };
}

async function captureSite(tab) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['lib/extract-site.js'],
  });
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'jpeg', quality: SCREENSHOT_QUALITY })
    .catch(() => '');
  return { ...result, screenshot_jpeg_base64: dataUrl.split(',')[1] ?? null };
}

function summarize(job, url) {
  return { jobId: job.job_id, url, status: job.status, label: job.label, steps: job.steps, errors: job.errors };
}

const isWebsite = (url) => /^https?:/.test(url);

// The same page and market within 30 minutes reuses the saved report at no cost.
async function runAnalysis() {
  // On the report tab there is no site to read, so the last site is used.
  if (!isWebsite(activeUrl) && state.own) await ownTab();
  const tab = await readOwnPage();
  const page = await captureSite(tab);
  const { samples, bundles, freeShipping } = state.capabilities;
  const job = await startAnalysis({ page, capabilities: { samples, bundles, freeShipping } });
  state.analysis = summarize(job, page.url);
  // A reused report is already finished, so no poll will fill Market for it.
  if (isFinished(job.status) && job.result) applyAnalysis(job);
  await chrome.storage.local.set({ [JOB_KEY]: { jobId: job.job_id, url: page.url } });
  await openReport();
  watchAnalysis();
}

async function openReport() {
  const page = chrome.runtime.getURL(`results.html?job=${encodeURIComponent(state.analysis.jobId)}`);
  await chrome.tabs.create({ url: page });
}

// Finished competitors appear in Market, ready to track.
function applyAnalysis(job) {
  if (state.appliedJob === job.job_id) return;
  state.appliedJob = job.job_id;
  const market = job.result.market;
  if (state.own && market?.country_code && market.status !== 'unconfirmed') state.own.country = market.country_code;
  if (!job.result.competitors.length) return;
  state.candidates = job.result.competitors.map((item) => ({
    url: item.url,
    title: item.name,
    why: item.why_relevant,
    category: item.category,
    selected: true,
  }));
  state.discoveryLabel = job.label;
}

function paintAnalysis() {
  const card = document.getElementById('analysis-card');
  if (card) card.outerHTML = analysisCard(state.analysis);
}

async function pollAnalysis() {
  const { jobId, url } = state.analysis ?? {};
  if (!jobId) return;
  try {
    const job = await getAnalysis(jobId);
    if (state.analysis?.jobId !== jobId) return;
    state.analysis = summarize(job, url);
    if (isFinished(job.status)) applyAnalysis(job);
  } catch (error) {
    if (!(error instanceof BackendError) || error.status !== 404) {
      watchTimer = setTimeout(pollAnalysis, POLL_MS * 3);
      return;
    }
    state.analysis = { ...state.analysis, status: 'expired', errors: [] };
  }
  await save();
  const running = !isFinished(state.analysis.status) && state.analysis.status !== 'expired';
  if (running) {
    paintAnalysis();
    watchTimer = setTimeout(pollAnalysis, POLL_MS);
  } else if (!ui.busy && !ui.sheet) {
    render();
  }
}

function watchAnalysis() {
  clearTimeout(watchTimer);
  if (state.analysis && !isFinished(state.analysis.status) && state.analysis.status !== 'expired') pollAnalysis();
}

const untracked = () => state.candidates.filter((item) =>
  item.selected && !state.rivals.some((rival) => rival.source === item.url));

async function trackSelected() {
  for (const candidate of untracked()) {
    const snapshot = await readPage(candidate.url);
    const rival = createRivalState(snapshot, new Date().toISOString());
    state.rivals.push({ ...rival, title: candidate.title, source: candidate.url });
  }
}

async function checkNow() {
  for (const [index, rival] of state.rivals.entries()) {
    const snapshot = await readPage(rival.url);
    state.rivals[index] = {
      ...trackRival(rival, snapshot, new Date().toISOString()),
      title: rival.title,
      source: rival.source,
    };
  }
}

function changesOfType(type) {
  return state.rivals.flatMap((rival) => [...rival.pending, ...rival.confirmed]
    .filter((change) => change.type === type)
    .map((change) => ({ ...change, rival: rival.title })));
}

async function propose(rivalIndex, changeId) {
  const rival = state.rivals[rivalIndex];
  const change = [...rival.pending, ...rival.confirmed].find((item) => item.id === changeId);
  const evidence = changesOfType(change.type)
    .sort((a, b) => Number(b.id === changeId) - Number(a.id === changeId))
    .map((item, index) => ({
      id: `e${index + 1}`,
      rival: item.rival,
      type: item.type,
      before: item.before,
      after: item.after,
      url: item.url,
    }));
  const result = await api('/api/experiment', {
    own: ownForRules(),
    capabilities: state.capabilities,
    evidence,
    rivalCount: state.rivals.length,
  });
  state.draft = {
    ...result.experiment,
    label: result.label,
    evidence,
    check: checkExperiment(result.experiment, state.capabilities, evidence.map((item) => item.id)),
    duration: estimateTestDuration({
      sessionsPerMonth: Number(state.capabilities.sessionsPerMonth),
      conversionRate: Number(state.capabilities.conversionPct) / 100,
    }),
    previewing: false,
  };
  ui.sheet = { name: 'experiment' };
}

// Runs inside the merchant page. Text goes in through textContent only.
function applyPreview(variant) {
  document.getElementById('distinct-watch-preview')?.remove();
  const box = document.createElement('aside');
  box.id = 'distinct-watch-preview';
  box.style.cssText = 'margin:16px 0;padding:16px;border-radius:18px;background:#60e4d8;color:#221b3d;font-family:system-ui,sans-serif';
  const line = (tagName, text, style) => {
    const element = document.createElement(tagName);
    element.textContent = text;
    element.style.cssText = style;
    box.append(element);
  };
  line('div', 'Local preview, visible only to you', 'font-size:12px;margin-bottom:6px');
  line('div', variant.headline, 'font-size:18px;font-weight:700;margin-bottom:4px');
  line('p', variant.body, 'margin:0 0 10px');
  line('button', variant.cta, 'padding:9px 14px;border:0;border-radius:12px;background:#6a45e8;color:#fff;font-weight:600;cursor:pointer;width:auto');
  const anchor = [...document.querySelectorAll('button, input[type="submit"], [name="add"]')]
    .find((element) => element.getClientRects().length > 0) ?? document.querySelector('h1');
  (anchor ?? document.body.firstElementChild).insertAdjacentElement('beforebegin', box);
  box.scrollIntoView({ block: 'center' });
}

function removePreview() {
  document.getElementById('distinct-watch-preview')?.remove();
}

async function ownTab() {
  const tabs = await chrome.tabs.query({});
  const found = tabs.find((tab) => tab.url?.split('#')[0] === state.own.url);
  if (found) {
    await chrome.tabs.update(found.id, { active: true });
    return found.id;
  }
  const tab = await chrome.tabs.create({ url: state.own.url, active: true });
  await waitForLoad(tab.id);
  return tab.id;
}

async function togglePreview() {
  const draft = state.draft;
  const tabId = await ownTab();
  if (draft.previewing) {
    await chrome.scripting.executeScript({ target: { tabId }, func: removePreview });
  } else {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: applyPreview,
      args: [{ headline: draft.headline, body: draft.body, cta: draft.cta }],
    });
  }
  draft.previewing = !draft.previewing;
}

function download(filename, content, type) {
  const url = URL.createObjectURL(content instanceof Blob ? content : new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function briefMarkdown(item) {
  const duration = item.duration
    ? `About ${item.duration.weeks} weeks, ${item.duration.perVariant} visitors per variant.`
    : 'No traffic data for an estimate.';
  const warning = item.duration?.tooLong
    ? '\nThis takes over six weeks. Choose a bigger change or a before/after test, with its limits.'
    : '';
  return `# Test: ${item.headline}

Text source: ${item.label}
Approved: ${when(item.approvedAt)}

A rival's change is a signal to investigate. It does not show that its sales grew.

## Hypothesis
${item.hypothesis}

## Proposed change
${item.headline}: ${item.body} (button: ${item.cta})

## Measurement
- Primary metric: ${item.primaryMetric}
- Guardrail metric: ${item.guardrailMetric}
- Duration: ${duration}${warning}
- Stop if: ${item.stopCondition}

## Sources
${item.evidence.map((e) => `- ${e.rival}: ${e.before ?? 'nothing'} -> ${e.after ?? 'removed'} (${e.url})`).join('\n')}
`;
}

function blockHtml(item) {
  return `<aside class="experiment-block">\n  <h3>${esc(item.headline)}</h3>\n  <p>${esc(item.body)}</p>\n  <button type="button">${esc(item.cta)}</button>\n</aside>\n`;
}

async function bannerPng(item) {
  await document.fonts.load('700 64px Lexend');
  const canvas = new OffscreenCanvas(1200, 628);
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, 1200, 628);
  gradient.addColorStop(0, '#6a45e8');
  gradient.addColorStop(1, '#8a66fc');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1200, 628);
  context.fillStyle = '#ffffff';
  context.font = '700 60px Lexend, system-ui, sans-serif';
  context.fillText(item.headline.slice(0, 32), 72, 290);
  context.font = '500 32px Lexend, system-ui, sans-serif';
  context.fillText(item.cta.slice(0, 48), 72, 360);
  return canvas.convertToBlob({ type: 'image/png' });
}

function approve() {
  state.approved.unshift({ ...state.draft, approvedAt: new Date().toISOString() });
  state.draft = null;
  ui.sheet = null;
}

async function refreshConnection() {
  const connection = { ...ui.connection };
  try {
    const health = await getHealth();
    const keys = health.anthropic_configured && health.tavily_configured;
    connection.analysis = 'ok';
    connection.analysisDetail = health.mode === 'mock' ? 'SIMULATED mode' : keys ? 'Keys set' : 'A key is missing in .env';
  } catch {
    connection.analysis = 'off';
    connection.analysisDetail = 'Start it with npm run backend';
  }
  try {
    const status = await api('/api/status');
    connection.demo = 'ok';
    connection.demoDetail = status.ai ? 'Tests use live AI' : 'Tests use SIMULATED answers';
  } catch {
    connection.demo = 'off';
    connection.demoDetail = 'Start it with npm start';
  }
  ui.connection = connection;
}

async function resetAll() {
  if (!ui.confirmReset) {
    ui.confirmReset = true;
    return;
  }
  await chrome.storage.local.remove([STATE_KEY, JOB_KEY, REPORT_KEY]);
  state = emptyState();
  ui.confirmReset = false;
  ui.sheet = null;
  ui.tab = 'home';
}

function selectTab(tab) {
  if (tab === ui.tab) return;
  ui.tab = tab;
  scroller.scrollTo({ top: 0 });
  app.classList.add('fade-in');
  setTimeout(() => app.classList.remove('fade-in'), FADE_MS);
}

function focusSelector(element) {
  if (!element || element === document.body) return null;
  const pairs = Object.entries(element.dataset ?? {});
  if (!pairs.length) return null;
  return pairs.map(([key, value]) => {
    const name = key.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
    return `[data-${name}="${CSS.escape(value)}"]`;
  }).join('');
}

function paintSheet() {
  if (ui.sheet) showSheet(sheet, sheetView(state, ui), ui.sheet.detent ?? 'medium');
  else hideSheet(sheet);
}

function paintChrome() {
  const look = lookOf(state, ui);
  const left = topLeftAction(state, ui);
  phone.dataset.look = look;
  stage.innerHTML = look === 'violet' ? stageView() : '';
  navTitle.textContent = look === 'right' ? titleOf(ui.tab) : '';
  topLeft.dataset.action = left.action;
  topLeft.setAttribute('aria-label', left.label);
  topLeft.title = left.label;
  topLeft.innerHTML = icon(left.icon);
  topLeft.disabled = Boolean(ui.busy);
}

function render() {
  const focused = focusSelector(document.activeElement);
  paintChrome();
  app.innerHTML = tabView(state, ui);
  tabbar.innerHTML = tabBarView(state, ui);
  paintSheet();
  if (focused) document.querySelector(focused)?.focus({ preventScroll: true });
}

function closeSheet() {
  if (state.draft?.previewing) togglePreview().catch(() => {});
  state.draft = null;
  ui.sheet = null;
  ui.confirmReset = false;
}

const actions = {
  analyze: runAnalysis,
  'open-report': openReport,
  track: async () => {
    await trackSelected();
    selectTab('changes');
  },
  check: checkNow,
  'open-offer': () => { ui.sheet = { name: 'offer', detent: 'large' }; },
  'open-settings': async () => {
    ui.sheet = { name: 'settings' };
    await refreshConnection();
  },
  'open-change': (dataset) => {
    ui.sheet = { name: 'change', rival: Number(dataset.rival), change: dataset.change };
  },
  'open-share': (dataset) => { ui.sheet = { name: 'share', index: Number(dataset.index) }; },
  'close-sheet': closeSheet,
  propose: (dataset) => propose(Number(dataset.rival), dataset.change),
  preview: togglePreview,
  approve: () => {
    approve();
    selectTab('tests');
  },
  'fix-caps': () => {
    state.draft = null;
    ui.sheet = { name: 'offer', detent: 'large' };
  },
  reset: resetAll,
  brief: (dataset) => {
    const item = state.approved[Number(dataset.index)];
    download('test-brief.md', briefMarkdown(item), 'text/markdown');
  },
  block: (dataset) => {
    const item = state.approved[Number(dataset.index)];
    download('page-block.html', blockHtml(item), 'text/html');
  },
  visual: async (dataset) => {
    const item = state.approved[Number(dataset.index)];
    download('test-visual.png', await bannerPng(item));
    await chrome.tabs.create({ url: 'https://new.express.adobe.com/' });
  },
};

async function runAction(action, dataset) {
  // Chrome requires this call inside the click, before any await.
  let granted = Promise.resolve(true);
  if (action === 'track') granted = requestOrigins(untracked().map((item) => item.url));
  if (action === 'analyze') {
    const target = isWebsite(activeUrl) ? activeUrl : state.own?.url;
    if (target) granted = requestOrigins([target]);
  }
  ui.busy = action;
  showNotice('');
  render();
  try {
    if (await granted === false) throw new Error('We need your permission to read these pages.');
    await actions[action](dataset);
    await save();
  } catch (error) {
    showNotice(error.message);
    if (!state.draft && !['offer', 'settings'].includes(ui.sheet?.name)) ui.sheet = null;
  } finally {
    ui.busy = null;
    render();
  }
}

document.addEventListener('click', (event) => {
  if (event.target === sheet) {
    if (!ui.busy) runAction('close-sheet', {});
    return;
  }
  const tab = event.target.closest('button[data-tab]');
  if (tab) {
    selectTab(tab.dataset.tab);
    render();
    return;
  }
  const chip = event.target.closest('button[data-chip]');
  if (chip) {
    ui.chip = ui.chip === chip.dataset.chip ? null : chip.dataset.chip;
    render();
    return;
  }
  const appearance = event.target.closest('button[data-appearance]');
  if (appearance) {
    ui.appearance = appearance.dataset.appearance;
    saveAppearance(ui.appearance);
    paintSheet();
    return;
  }
  const button = event.target.closest('button[data-action]');
  if (button && !ui.busy) runAction(button.dataset.action, { ...button.dataset });
});

sheet.addEventListener('cancel', (event) => {
  event.preventDefault();
  if (!ui.busy) runAction('close-sheet', {});
});

// No re-render for text fields: replacing the DOM here would swallow a click in progress.
document.addEventListener('change', async (event) => {
  const { dataset, type, checked, value } = event.target;
  if (dataset.cap) state.capabilities[dataset.cap] = type === 'checkbox' ? checked : value;
  if (dataset.select) {
    state.candidates[Number(dataset.select)].selected = checked;
    render();
  }
  await save();
});

// Typing only hides cards: rebuilding the screen would take the cursor out of the field.
document.addEventListener('input', (event) => {
  if (!('query' in event.target.dataset)) return;
  ui.query = event.target.value;
  app.querySelectorAll('[data-card]').forEach((card) => {
    card.hidden = !matchesFilter(state.candidates[Number(card.dataset.card)], ui);
  });
});

async function refreshActiveUrl() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeUrl = tab?.url ?? '';
}

function initialTab() {
  if (state.rivals.length) return 'changes';
  return 'home';
}

async function start() {
  ui.appearance = await initTheme();
  document.getElementById('settings').innerHTML = icon('gear');
  chrome.tabs.onActivated.addListener(refreshActiveUrl);
  chrome.tabs.onUpdated.addListener(refreshActiveUrl);
  await refreshActiveUrl();
  const stored = await chrome.storage.local.get(STATE_KEY);
  if (stored[STATE_KEY]?.version === STATE_VERSION) state = stored[STATE_KEY];
  else await chrome.storage.local.remove([STATE_KEY, JOB_KEY, REPORT_KEY]);
  state.draft = null;
  ui.tab = initialTab();
  watchSheetDrag(sheet, () => {
    if (!ui.busy) runAction('close-sheet', {});
  });
  render();
  watchAnalysis();
  // The results page can start a new job after a market correction.
  chrome.storage.onChanged.addListener((changes) => {
    const next = changes[JOB_KEY]?.newValue;
    if (!next || next.jobId === state.analysis?.jobId) return;
    state.analysis = { jobId: next.jobId, url: next.url, status: 'queued', label: '', steps: [], errors: [] };
    watchAnalysis();
  });
}

start();
