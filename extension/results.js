import {
  BackendError, getAnalysis, isFinished, JOB_KEY, POLL_MS, REPORT_KEY, startAnalysis,
} from './lib/analysis.js';
import { hideSheet, showSheet, watchSheetDrag } from './ui/sheet.js';
import { initTheme } from './ui/theme.js';
import {
  competitorSheet, missingView, recommendationSheet, reportNavView, reportView, SECTIONS,
  skippedSheet, sourcesSheet,
} from './ui/report.js';

const report = document.getElementById('report');
const nav = document.getElementById('report-nav');
const sheet = document.getElementById('sheet');

let job = null;
let busy = false;
let notice = '';
let current = 'overview';
let priority = null;
let windowId;
let pollTimer;

// Each phone scrolls on its own, so every one keeps its place across a repaint.
function paint() {
  const scroll = new Map([...report.querySelectorAll('.phone')]
    .map((item) => [item.dataset.section, item.querySelector('.scroller')?.scrollTop ?? 0]));
  report.innerHTML = job ? reportView(job, { notice, section: current, busy, priority }) : missingView(notice);
  nav.innerHTML = reportNavView(current);
  report.querySelectorAll('.phone').forEach((item) => {
    const scroller = item.querySelector('.scroller');
    if (scroller) scroller.scrollTop = scroll.get(item.dataset.section) ?? 0;
  });
}

function updateAddress() {
  const params = new URLSearchParams({ section: current });
  if (job?.job_id) params.set('job', job.job_id);
  history.replaceState(null, '', `results.html?${params}`);
}

async function saveReport(full) {
  try {
    await chrome.storage.local.set({ [REPORT_KEY]: full });
  } catch {
    // Storage full. The report stays on screen and on the server for 30 minutes.
  }
}

async function finish(jobId) {
  job = await getAnalysis(jobId, { screenshots: true });
  await saveReport(job);
  paint();
}

async function showSaved(jobId, message) {
  const stored = await chrome.storage.local.get(REPORT_KEY);
  const saved = stored[REPORT_KEY];
  if (saved?.job_id === jobId) {
    job = saved;
    notice = '';
  } else {
    job = null;
    notice = `${message} Start a new analysis from the panel.`;
  }
  paint();
}

async function poll(jobId) {
  try {
    const next = await getAnalysis(jobId);
    const changed = next.updated_at !== job?.updated_at || next.status !== job?.status;
    job = next;
    if (isFinished(next.status)) {
      await finish(jobId);
      return;
    }
    // Rebuilding the page would interrupt the reader, so it happens only on real changes.
    if (changed) paint();
  } catch (error) {
    if (error instanceof BackendError && error.status === 404) {
      await showSaved(jobId, 'This analysis is no longer on the server.');
      return;
    }
    notice = error.message;
    paint();
  }
  pollTimer = setTimeout(() => poll(jobId), POLL_MS);
}

async function rerun() {
  const country = document.getElementById('market-country')?.value ?? '';
  const language = document.getElementById('market-language')?.value ?? '';
  const market = job.result.market;
  const corrected = country && (country !== market?.country_code || language !== market?.language);
  if (!corrected) {
    notice = 'Choose a different country or language first.';
    paint();
    return;
  }
  clearTimeout(pollTimer);
  busy = true;
  notice = '';
  paint();
  try {
    const next = await startAnalysis({
      rerun_of: job.job_id,
      market_override: { country_code: country, language },
    });
    job = next;
    updateAddress();
    await chrome.storage.local.set({ [JOB_KEY]: { jobId: next.job_id, url: next.result.profile?.url ?? '' } });
    poll(next.job_id);
  } catch (error) {
    notice = error.message;
  } finally {
    busy = false;
    paint();
  }
}

const sheets = {
  'open-sources': (dataset) => sourcesSheet(job, dataset.ids.split(',')),
  'open-competitor': (dataset) => competitorSheet(job, Number(dataset.index)),
  'open-recommendation': (dataset) => recommendationSheet(job, Number(dataset.index)),
  'open-skipped': () => skippedSheet(job),
};

const LARGE_SHEETS = new Set(['open-competitor', 'open-recommendation']);

document.addEventListener('click', (event) => {
  if (event.target === sheet) {
    hideSheet(sheet);
    return;
  }
  const segment = event.target.closest('button[data-section]');
  if (segment) {
    current = segment.dataset.section;
    updateAddress();
    paint();
    return;
  }
  const filter = event.target.closest('button[data-priority]');
  if (filter) {
    priority = priority === filter.dataset.priority ? null : filter.dataset.priority;
    paint();
    return;
  }
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const { action } = button.dataset;
  if (action === 'close-sheet') hideSheet(sheet);
  // Chrome only opens the panel inside the click, before any await.
  else if (action === 'open-panel') {
    chrome.sidePanel.open({ windowId }).catch(() => {
      notice = 'Click the extension icon to open the panel.';
      paint();
    });
  }
  else if (action === 'rerun' && job && !busy) rerun();
  else if (sheets[action]) showSheet(sheet, sheets[action](button.dataset), LARGE_SHEETS.has(action) ? 'large' : 'medium');
});

async function start() {
  await initTheme();
  windowId = (await chrome.tabs.getCurrent())?.windowId;
  watchSheetDrag(sheet, () => hideSheet(sheet));
  const params = new URLSearchParams(location.search);
  if (SECTIONS.some((item) => item.id === params.get('section'))) current = params.get('section');
  paint();
  const stored = await chrome.storage.local.get(JOB_KEY);
  const jobId = params.get('job') ?? stored[JOB_KEY]?.jobId;
  if (!jobId) {
    notice = 'No analysis yet. Start one from the panel.';
    paint();
    return;
  }
  poll(jobId);
}

start();
