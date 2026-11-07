import http from 'node:http';
import { aiEnabled, proposeExperiment } from './ai.mjs';
import { experimentMode, simulatedExperiment } from './simulated.mjs';
import { getPhase, renderDemo, setPhase } from './demo.mjs';

const PORT = Number(process.env.PORT ?? 8787);
const HOST = '127.0.0.1';
const BASE = `http://localhost:${PORT}`;
const MAX_BODY_BYTES = 1_000_000;
const NO_KEY_ERROR = 'ANTHROPIC_API_KEY is missing from .env. Real sites never get simulated results.';

function readJson(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Request too large.'), { status: 413 }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(Object.assign(new Error('Invalid JSON.'), { status: 400 }));
      }
    });
    request.on('error', reject);
  });
}

function send(response, status, body, type = 'application/json; charset=utf-8') {
  response.writeHead(status, { 'content-type': type });
  response.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
}

function allowExtension(request, response) {
  const origin = request.headers.origin ?? '';
  if (origin.startsWith('chrome-extension://')) {
    response.setHeader('access-control-allow-origin', origin);
    response.setHeader('access-control-allow-headers', 'content-type');
    response.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
  }
}

async function handleApi(request, response, path) {
  if (path === '/api/status' && request.method === 'GET') {
    return send(response, 200, { ai: aiEnabled() });
  }
  if (path === '/api/experiment' && request.method === 'POST') {
    const body = await readJson(request);
    if (!body.evidence?.length) return send(response, 400, { error: 'Evidence is missing.' });
    const mode = experimentMode(body.evidence, aiEnabled());
    if (mode === 'unavailable') return send(response, 503, { error: NO_KEY_ERROR });
    if (mode === 'live') {
      return send(response, 200, { label: 'LIVE', experiment: await proposeExperiment(body) });
    }
    return send(response, 200, { label: 'SIMULATED', experiment: simulatedExperiment(body) });
  }
  return send(response, 404, { error: 'Unknown route.' });
}

const server = http.createServer(async (request, response) => {
  const { pathname } = new URL(request.url, BASE);
  allowExtension(request, response);
  try {
    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      return response.end();
    }
    if (pathname.startsWith('/api/')) return await handleApi(request, response, pathname);
    if (pathname === '/demo/state' && request.method === 'POST') {
      setPhase((await readJson(request)).phase);
      return send(response, 200, { phase: getPhase() });
    }
    if (pathname === '/' || pathname.startsWith('/demo')) {
      const page = renderDemo(pathname === '/' ? '/demo/control' : pathname);
      return send(response, page.status, page.html, 'text/html; charset=utf-8');
    }
    return send(response, 404, { error: 'Unknown route.' });
  } catch (error) {
    console.error(error);
    if (!response.headersSent) {
      send(response, error.status ?? 502, { error: error.status ? error.message : 'Claude did not respond.' });
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Distinct: ${BASE}/demo/control (AI: ${aiEnabled() ? 'LIVE' : 'SIMULATED'})`);
});
