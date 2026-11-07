import {
  checkExperiment,
  classifyCandidate,
  createRivalState,
  estimateTestDuration,
  makeSnapshot,
  trackRival,
} from './lib/rules.js';
import { esc, sheetView, tabBarView, TABS, tabView, TITLES, updateAnalysisCard, when } from './ui/views.js';
import { icon } from './ui/icons.js';
import { BackendError, getAnalysis, isFinished, JOB_KEY, POLL_MS, startAnalysis } from './lib/analysis.js';

const SERVER = 'http://localhost:8787';
const PAGE_TIMEOUT_MS = 15000;
const RECHECK_DAYS = 7;
const app = document.getElementById('app');
const notice = document.getElementById('notice');
const tabbar = document.getElementById('tabbar');
const indicator = document.getElementById('tab-indicator');
const sheet = document.getElementById('sheet');
const scroller = document.getElementById('scroller');
const navTitle = document.getElementById('nav-title');
const navbar = document.querySelector('.navbar');

const TAB_DURING = { discover: 'market', 'read-candidates': 'market', check: 'changes' };
const TAB_AFTER = { track: 'changes', approve: 'experiments', 'fix-caps': 'product' };
const SCREENSHOT_QUALITY = 60;

let state = {
  own: null,
  capabilities: { samples: false, bundles: false, freeShipping: false, maxDiscountPct: 0, sessionsPerMonth: '', conversionPct: '' },
  candidates: [],
  discoveryLabel: null,
  classified: [],
  rivals: [],
  draft: null,
  approved: [],
};
const ENTER_MS = 700;
const TILT_DEG = 10;
const PARALLAX_PX = 16;
const ui = { tab: 'product', busy: null, entered: false };
let enterTimer;
let activeUrl = '';

async function save() {
  await chrome.storage.local.set({ distinctWatch: state });
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
    throw new Error('Serverul local nu răspunde. Pornește-l cu npm start.');
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Serverul a întors o eroare.');
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
  if (!/^https?:/.test(tab?.url ?? '')) throw new Error('Deschide mai întâi site-ul tău.');
  const raw = await extractFrom(tab.id).catch(() => {
    throw new Error('Nu am acces la această pagină. Apasă iconița extensiei și încearcă din nou.');
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

async function discover() {
  const result = await api('/api/discover', { own: ownForRules() });
  state.candidates = result.candidates;
  state.discoveryLabel = result.label;
  state.classified = [];
}

// A competitor verified by the analysis is a site, not a product page, so the
// product-page rules would call it not comparable. Its evidence is already saved.
function verdictFor(candidate, snapshot, own) {
  if (snapshot.status !== 'ok') return { status: snapshot.status, reasons: [] };
  if (!candidate.verified) return classifyCandidate(snapshot, own);
  return { status: 'rival', reasons: [{ criterion: 'analiza site-ului', state: 'ok', evidence: candidate.why }] };
}

async function readCandidates() {
  const own = ownForRules();
  const classified = [];
  for (const candidate of state.candidates) {
    const snapshot = await readPage(candidate.url);
    const blocked = snapshot.status !== 'ok';
    const verdict = verdictFor(candidate, snapshot, own);
    classified.push({
      ...verdict,
      url: candidate.url,
      title: blocked ? candidate.title : snapshot.product.name || candidate.title,
      snapshot,
      selected: verdict.status === 'rival' || blocked,
    });
  }
  state.classified = classified;
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
  return {
    jobId: job.job_id,
    url,
    status: job.status,
    label: job.label,
    steps: job.steps,
    errors: job.errors,
  };
}

async function analyze() {
  await readOwnPage();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const page = await captureSite(tab);
  const job = await startAnalysis({
    page,
    capabilities: {
      samples: state.capabilities.samples,
      bundles: state.capabilities.bundles,
      freeShipping: state.capabilities.freeShipping,
    },
  });
  state.analysis = summarize(job, page.url);
  await chrome.storage.local.set({ [JOB_KEY]: { jobId: job.job_id, url: page.url } });
  await openReport();
  watchAnalysis();
}

async function openReport() {
  const page = chrome.runtime.getURL(`results.html?job=${encodeURIComponent(state.analysis.jobId)}`);
  await chrome.tabs.create({ url: page });
}

// Finished competitors feed the existing tracking flow in the Market tab.
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
    verified: item.category,
  }));
  state.discoveryLabel = job.label;
  state.classified = [];
}

function paintAnalysis() {
  const card = document.getElementById('analysis-card');
  if (card) card.outerHTML = updateAnalysisCard(state.analysis);
}

let watchTimer;

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
    state.analysis = { ...state.analysis, status: 'expired', errors: [{ message: 'Analiza a expirat pe server. Raportul salvat rămâne disponibil.' }] };
  }
  await save();
  paintAnalysis();
  if (!isFinished(state.analysis.status) && state.analysis.status !== 'expired') {
    watchTimer = setTimeout(pollAnalysis, POLL_MS);
  } else if (!ui.busy) {
    render();
  }
}

function watchAnalysis() {
  clearTimeout(watchTimer);
  if (state.analysis && !isFinished(state.analysis.status) && state.analysis.status !== 'expired') pollAnalysis();
}

function trackSelected() {
  const now = new Date().toISOString();
  const known = new Set(state.rivals.map((rival) => rival.url));
  for (const item of state.classified) {
    if (!item.selected || known.has(item.url)) continue;
    state.rivals.push({ ...createRivalState(item.snapshot, now), title: item.title });
  }
}

async function checkNow() {
  for (const [index, rival] of state.rivals.entries()) {
    const snapshot = await readPage(rival.url);
    state.rivals[index] = { ...trackRival(rival, snapshot, new Date().toISOString()), title: rival.title };
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
}

// Runs inside the merchant page. Text goes in through textContent only.
function applyPreview(variant) {
  document.getElementById('distinct-watch-preview')?.remove();
  const box = document.createElement('aside');
  box.id = 'distinct-watch-preview';
  box.style.cssText = 'margin:16px 0;padding:14px;border:2px dashed #1f5f5b;border-radius:8px;background:#fff;color:#1f1d1a;font-family:system-ui,sans-serif';
  const line = (tagName, text, style) => {
    const element = document.createElement(tagName);
    element.textContent = text;
    element.style.cssText = style;
    box.append(element);
  };
  line('div', 'Previzualizare locală, vizibilă doar pentru tine', 'font-size:12px;color:#68635b;margin-bottom:6px');
  line('div', variant.headline, 'font-size:18px;font-weight:600;margin-bottom:4px');
  line('p', variant.body, 'margin:0 0 10px');
  line('button', variant.cta, 'padding:8px 12px;border:1px solid #1f5f5b;border-radius:6px;background:#1f5f5b;color:#fff;cursor:pointer;width:auto');
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
    ? `Aproximativ ${item.duration.weeks} săptămâni, ${item.duration.perVariant} vizitatori pe variantă.`
    : 'Nu am date de trafic pentru un calcul.';
  const warning = item.duration?.tooLong
    ? '\nDepășește șase săptămâni. Alege o schimbare mai mare sau un test înainte/după, cu limitele lui.'
    : '';
  return `# Experiment: ${item.headline}

Proveniență text: ${item.label}
Aprobat: ${when(item.approvedAt)}
Reverificare rival: ${when(item.recheckAt)}

Schimbarea la rival e un semnal de investigat. Nu arată că i-au crescut vânzările.

## Ipoteză
${item.hypothesis}

## Schimbare propusă
${item.headline}: ${item.body} (buton: ${item.cta})

## Măsurare
- Metrică principală: ${item.primaryMetric}
- Metrică de control: ${item.guardrailMetric}
- Durată: ${duration}${warning}
- Condiție de oprire: ${item.stopCondition}

## Dovezi
${item.evidence.map((e) => `- ${e.rival}: ${e.before ?? 'nimic'} -> ${e.after ?? 'eliminat'} (${e.url})`).join('\n')}
`;
}

function blockHtml(item) {
  return `<aside class="experiment-block">\n  <h3>${esc(item.headline)}</h3>\n  <p>${esc(item.body)}</p>\n  <button type="button">${esc(item.cta)}</button>\n</aside>\n`;
}

async function bannerPng(item) {
  const canvas = new OffscreenCanvas(1200, 628);
  const context = canvas.getContext('2d');
  context.fillStyle = '#1f5f5b';
  context.fillRect(0, 0, 1200, 628);
  context.fillStyle = '#ffffff';
  context.font = '600 64px Georgia, serif';
  context.fillText(item.headline.slice(0, 32), 72, 290);
  context.font = '32px system-ui, sans-serif';
  context.fillText(item.cta.slice(0, 48), 72, 360);
  return canvas.convertToBlob({ type: 'image/png' });
}

function approve() {
  const now = Date.now();
  state.approved.unshift({
    ...state.draft,
    approvedAt: new Date(now).toISOString(),
    recheckAt: new Date(now + RECHECK_DAYS * 86400000).toISOString(),
  });
  state.draft = null;
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

function selectTab(tab) {
  if (tab === ui.tab && ui.entered) return;
  const step = TABS.findIndex((item) => item.id === tab) - TABS.findIndex((item) => item.id === ui.tab);
  app.style.setProperty('--dir', step < 0 ? -1 : 1);
  ui.tab = tab;
  ui.entered = true;
  app.classList.remove('enter');
  void app.offsetWidth;
  app.classList.add('enter');
  clearTimeout(enterTimer);
  enterTimer = setTimeout(() => app.classList.remove('enter'), ENTER_MS);
  scroller.scrollTo({ top: 0 });
}

function render() {
  const focused = focusSelector(document.activeElement);
  navTitle.textContent = TITLES[ui.tab];
  app.innerHTML = tabView(state, ui);
  tabbar.innerHTML = tabBarView(state, ui);
  const index = TABS.findIndex((tab) => tab.id === ui.tab);
  indicator.style.setProperty('--index', index < 2 ? index : index + 1);
  if (state.draft) {
    sheet.innerHTML = sheetView(state.draft, ui);
    if (!sheet.open) sheet.showModal();
  } else if (sheet.open) {
    sheet.close();
    sheet.innerHTML = '';
  }
  if (focused) document.querySelector(focused)?.focus({ preventScroll: true });
}

const actions = {
  'read-own': readOwnPage,
  analyze,
  'open-report': openReport,
  discover,
  'read-candidates': readCandidates,
  track: trackSelected,
  check: checkNow,
  propose: (dataset) => propose(Number(dataset.rival), dataset.change),
  preview: togglePreview,
  approve,
  reject: async () => {
    if (state.draft?.previewing) await togglePreview();
    state.draft = null;
  },
  'fix-caps': () => { state.draft = null; },
  brief: (dataset) => {
    const item = state.approved[Number(dataset.index)];
    download('brief-experiment.md', briefMarkdown(item), 'text/markdown');
  },
  block: (dataset) => {
    const item = state.approved[Number(dataset.index)];
    download('bloc-experiment.html', blockHtml(item), 'text/html');
  },
  visual: async (dataset) => {
    const item = state.approved[Number(dataset.index)];
    download('vizual-experiment.png', await bannerPng(item));
    await chrome.tabs.create({ url: 'https://new.express.adobe.com/' });
  },
};

async function runAction(action, dataset) {
  // Chrome requires this call inside the click, before any await.
  let granted = Promise.resolve(true);
  if (action === 'read-candidates') granted = requestOrigins(state.candidates.map((c) => c.url));
  if (['read-own', 'analyze'].includes(action) && /^https?:/.test(activeUrl)) granted = requestOrigins([activeUrl]);
  ui.busy = action;
  showNotice('');
  if (TAB_DURING[action]) selectTab(TAB_DURING[action]);
  render();
  try {
    if (await granted === false) throw new Error('Fără permisiune nu pot citi aceste pagini.');
    await actions[action](dataset);
    await save();
    if (TAB_AFTER[action]) selectTab(TAB_AFTER[action]);
  } catch (error) {
    showNotice(error.message);
  } finally {
    ui.busy = null;
    render();
  }
}

document.addEventListener('click', (event) => {
  if (event.target === sheet) {
    runAction('reject', {});
    return;
  }
  const tab = event.target.closest('button[data-tab]');
  if (tab) {
    selectTab(tab.dataset.tab);
    render();
    return;
  }
  const button = event.target.closest('button[data-action]');
  if (button && !ui.busy) runAction(button.dataset.action, { ...button.dataset });
});

sheet.addEventListener('cancel', (event) => {
  event.preventDefault();
  if (!ui.busy) runAction('reject', {});
});

// No re-render for text fields: replacing the DOM here would swallow a click in progress.
app.addEventListener('change', async (event) => {
  const { dataset, type, checked, value } = event.target;
  if (dataset.own) state.own[dataset.own] = value;
  if (dataset.cap) state.capabilities[dataset.cap] = type === 'checkbox' ? checked : value;
  if (dataset.select) {
    state.classified[Number(dataset.select)].selected = checked;
    render();
  }
  await save();
});

async function refreshActiveUrl() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeUrl = tab?.url ?? '';
}

function watchScroll() {
  scroller.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', scroller.scrollTop > 8);
  }, { passive: true });
}

// Hero objects follow the pointer, so the card reads as a real 3D surface.
function watchTilt() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  app.addEventListener('pointermove', (event) => {
    const hero = event.target.closest('[data-tilt]');
    if (!hero) return;
    const box = hero.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;
    hero.style.setProperty('--ry', `${x * TILT_DEG}deg`);
    hero.style.setProperty('--rx', `${y * -TILT_DEG}deg`);
    hero.style.setProperty('--px', `${x * PARALLAX_PX}px`);
    hero.style.setProperty('--py', `${y * PARALLAX_PX}px`);
  });
  app.addEventListener('pointerout', (event) => {
    const hero = event.target.closest('[data-tilt]');
    if (!hero || hero.contains(event.relatedTarget)) return;
    ['--rx', '--ry', '--px', '--py'].forEach((name) => hero.style.removeProperty(name));
  });
}

function initialTab() {
  if (state.rivals.length) return 'changes';
  return state.candidates.length ? 'market' : 'product';
}

async function start() {
  chrome.tabs.onActivated.addListener(refreshActiveUrl);
  chrome.tabs.onUpdated.addListener(refreshActiveUrl);
  await refreshActiveUrl();
  const stored = await chrome.storage.local.get('distinctWatch');
  if (stored.distinctWatch) state = stored.distinctWatch;
  ui.tab = initialTab();
  watchScroll();
  watchTilt();
  selectTab(ui.tab);
  render();
  watchAnalysis();
  // The results page can start a new job after a market correction.
  chrome.storage.onChanged.addListener((changes) => {
    const next = changes[JOB_KEY]?.newValue;
    if (!next || next.jobId === state.analysis?.jobId) return;
    state.analysis = { jobId: next.jobId, url: next.url, status: 'queued', label: '', steps: [], errors: [] };
    watchAnalysis();
  });
  const mode = document.getElementById('mode');
  try {
    const status = await api('/api/status');
    mode.textContent = status.ai ? 'AI: LIVE' : 'AI: SIMULAT';
    mode.title = status.ai ? 'Răspunsuri de la Claude' : 'Fără cheie API, rezultatele AI sunt simulate';
  } catch (error) {
    mode.textContent = 'Server oprit';
    showNotice(error.message);
  }
}

start();
