import {
  BackendError, getAnalysis, isFinished, JOB_KEY, POLL_MS, REPORT_KEY, startAnalysis,
} from './lib/analysis.js';
import { dockView, missingView, reportView, SECTIONS } from './ui/report.js';

const report = document.getElementById('report');
const dock = document.getElementById('dock-items');
const indicator = document.getElementById('tab-indicator');
const mode = document.getElementById('mode');
const scroller = document.getElementById('scroller');
const navbar = document.querySelector('.navbar');
const SECTION_LINE_PX = 140;

let job = null;
let busy = false;
let notice = '';
let active = 0;
let pollTimer;

function placeIndicator() {
  indicator.style.setProperty('--index', active < 2 ? active : active + 1);
}

function paintDock() {
  dock.innerHTML = dockView(job, busy, active);
  placeIndicator();
}

// Scrolling only moves the indicator. Rebuilding the dock here could swallow a click.
function followScroll() {
  navbar.classList.toggle('scrolled', scroller.scrollTop > 8);
  const line = scroller.getBoundingClientRect().top + SECTION_LINE_PX;
  const passed = SECTIONS.map((item, index) => ({ index, node: document.getElementById(item.id) }))
    .filter(({ node }) => node && node.getBoundingClientRect().top <= line);
  const next = passed.at(-1)?.index ?? 0;
  if (next === active) return;
  active = next;
  placeIndicator();
  dock.querySelectorAll('button[data-section]').forEach((node, index) => {
    node.toggleAttribute('aria-current', index === active);
    if (index === active) node.setAttribute('aria-current', 'true');
  });
}

// Rebuilding the page would close open details and move focus, so it happens
// only when the job changed, never on a timer alone.
function paint() {
  const open = [...report.querySelectorAll('details[open] > summary')].map((node) => node.textContent);
  const top = scroller.scrollTop;
  report.innerHTML = job ? reportView(job, { notice }) : missingView(notice);
  report.querySelectorAll('details > summary').forEach((node) => {
    if (open.includes(node.textContent)) node.parentElement.open = true;
  });
  scroller.scrollTop = top;
  mode.textContent = job?.label ?? '';
  paintDock();
}

async function saveReport(full) {
  try {
    await chrome.storage.local.set({ [REPORT_KEY]: full });
  } catch {
    // Storage full. The report stays on screen and on the server for 30 minutes.
  }
}

async function finish(jobId) {
  const full = await getAnalysis(jobId, { screenshots: true });
  job = full;
  await saveReport(full);
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
    if (changed) paint();
  } catch (error) {
    if (error instanceof BackendError && error.status === 404) {
      await showSaved(jobId, 'Analiza nu mai e pe server.');
      return;
    }
    notice = error.message;
    paint();
  }
  pollTimer = setTimeout(() => poll(jobId), POLL_MS);
}

async function showSaved(jobId, message) {
  const stored = await chrome.storage.local.get(REPORT_KEY);
  const saved = stored[REPORT_KEY];
  if (saved?.job_id === jobId) {
    job = saved;
    notice = '';
  } else {
    job = null;
    notice = `${message} Pornește o analiză nouă din panou.`;
  }
  paint();
}

function watch(jobId) {
  clearTimeout(pollTimer);
  history.replaceState(null, '', `results.html?job=${encodeURIComponent(jobId)}`);
  poll(jobId);
}

async function rerun() {
  const country = document.getElementById('market-country')?.value.trim() ?? '';
  const language = document.getElementById('market-language')?.value.trim() ?? '';
  if (country && !/^[a-zA-Z]{2}$/.test(country)) {
    notice = 'Țara se scrie cu două litere, de exemplu RO.';
    paint();
    return;
  }
  const market = job.result.market;
  const corrected = country && (country.toUpperCase() !== market?.country_code || language.toLowerCase() !== market?.language);
  busy = true;
  notice = '';
  paintDock();
  try {
    const next = await startAnalysis({
      rerun_of: job.job_id,
      market_override: corrected ? { country_code: country, language } : null,
    });
    job = next;
    await chrome.storage.local.set({ [JOB_KEY]: { jobId: next.job_id, url: next.result.profile?.url ?? '' } });
    watch(next.job_id);
    scroller.scrollTo({ top: 0 });
  } catch (error) {
    notice = error.message;
  } finally {
    busy = false;
    paint();
  }
}

document.addEventListener('click', (event) => {
  if (event.target.closest('button[data-action="rerun"]') && job && !busy) {
    rerun();
    return;
  }
  const section = event.target.closest('button[data-section]');
  if (!section) return;
  active = SECTIONS.findIndex((item) => item.id === section.dataset.section);
  paintDock();
  document.getElementById(section.dataset.section)?.scrollIntoView({ block: 'start' });
});

async function start() {
  scroller.addEventListener('scroll', followScroll, { passive: true });
  paint();
  const stored = await chrome.storage.local.get(JOB_KEY);
  const jobId = new URLSearchParams(location.search).get('job') ?? stored[JOB_KEY]?.jobId;
  if (!jobId) {
    notice = 'Nu există încă nicio analiză. Pornește una din panou.';
    paint();
    return;
  }
  poll(jobId);
}

start();
