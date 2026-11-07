# Distinct Watch Implementation Plan

**Goal:** A working MVP of the Chrome extension from the approved plan, runnable on a local demo.

**Architecture:** A dependency-free MV3 extension (side panel, content scripts, local storage) holds capture, diff and rules. A small Node server keeps keys, calls Claude and search, and serves the test store and rival pages. Pure rule logic lives in one shared ES module, tested with `node --test`.

**Tech stack:** Plain JavaScript, Chrome Manifest V3, Node 24, `@anthropic-ai/sdk`.

**Spec:** `PLAN-Distinct-Watch.md`

## Global constraints

- No API keys in the extension.
- No bypass of CAPTCHA, login or blocks.
- Nothing is published to a store. Preview is local DOM only.
- No opaque scores. Use states: confirmed, to confirm, blocked.
- A rival change is a signal to investigate, never proof of sales.
- Every experiment claim must link to a saved evidence snippet.
- Demo data carries a LIVE, CAPTURĂ or SIMULAT label in the UI.
- UI copy is in Romanian.

## Review focus

- Unread price on a later check must show "Necitit", never a change.
- A blocked or missing page must never look like a removed offer.
- A change seen once is "de confirmat"; it needs a second observation.
- An experiment using an undeclared capability must be rejected.
- With no API key, the product must work and label its output SIMULAT.

## Tasks

1. **Rules (`extension/lib/rules.js`, `test/rules.test.mjs`):** `classifyCandidate`, `diffSnapshots`, `confirmChanges`, `checkExperiment`, `estimateTestDuration`, `normalizePrice`.
2. **Server (`server/`):** `POST /api/discover`, `POST /api/experiment`, `GET /api/status`, plus demo pages under `/demo/`. Without a key it returns a labelled simulated result.
3. **Demo store (`server/demo/`):** test product page, two rival pages with before/after state, a blocked page, a marketplace, a foreign store.
4. **Extension (`extension/`):** manifest, service worker, page extractor, side panel with setup, rivals, changes, experiment, preview and brief export.
5. **End-to-end check:** run tests, run the server, drive the flow in a browser, load the unpacked extension manually.
