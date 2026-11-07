// Talks to the Python backend. Used by the panel and by the results page.

export const BACKEND = 'http://localhost:8788';
export const POLL_MS = 2000;
export const JOB_KEY = 'distinctAnalysis';
export const REPORT_KEY = 'distinctReport';

const FINISHED = new Set(['done', 'partial', 'failed']);

export const isFinished = (status) => FINISHED.has(status);

function errorText(detail) {
  if (typeof detail === 'string') return detail;
  return 'The analysis server refused the request.';
}

export class BackendError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, options) {
  let response;
  try {
    response = await fetch(`${BACKEND}${path}`, options);
  } catch {
    throw new BackendError('The analysis server is not responding. Start it with npm run backend.', 0);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new BackendError(errorText(data.detail), response.status);
  return data;
}

export function startAnalysis(body) {
  return request('/api/analyses', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function getHealth() {
  return request('/api/health');
}

export function getAnalysis(jobId, { screenshots = false } = {}) {
  return request(`/api/analyses/${encodeURIComponent(jobId)}${screenshots ? '?screenshots=true' : ''}`);
}
