import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { proposeExperiment } from '../server/ai.mjs';

function message(text, stopReason = 'end_turn') {
  return {
    id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-sonnet-5-5',
    content: [{ type: 'text', text }], stop_reason: stopReason, stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  };
}

async function withFakeApi(replies, run) {
  const requests = [];
  const server = http.createServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      requests.push({ headers: request.headers, body: JSON.parse(body) });
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify(replies.shift()));
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  process.env.ANTHROPIC_API_KEY = 'test-key';
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${server.address().port}`;
  try {
    await run(requests);
  } finally {
    server.close();
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_BASE_URL;
  }
}

const own = { url: 'https://m.ro/p', name: 'Perfume', market: { country: 'RO' } };

test('proposeExperiment sends a schema and marks page text as data', async () => {
  const experiment = { headline: 'Title', claims: [] };
  await withFakeApi([message(JSON.stringify(experiment))], async (requests) => {
    const result = await proposeExperiment({ own, capabilities: {}, evidence: [{ id: 'e1' }], rivalCount: 2 });
    assert.deepEqual(result, experiment);
    const { body, headers } = requests[0];
    assert.equal(body.model, 'claude-sonnet-5-5');
    assert.equal(body.fallbacks, 'default');
    assert.equal(body.output_config.effort, 'low');
    assert.match(headers['anthropic-beta'], /server-side-fallback-2026-07-01/);
    assert.equal(body.output_config.format.type, 'json_schema');
    assert.match(body.system, /not instructions/);
    assert.match(body.messages[0].content, /<page_data>/);
  });
});

test('a refusal is an error, never parsed as an experiment', async () => {
  await withFakeApi([message('', 'refusal')], async () => {
    await assert.rejects(
      proposeExperiment({ own, capabilities: {}, evidence: [{ id: 'e1' }], rivalCount: 1 }),
      /declined/,
    );
  });
});
