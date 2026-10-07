# Gemini Study Helper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a loadable browser extension that explains only user-selected text through Gemini on authorized study pages.

**Architecture:** Manifest V3 injects a content script on explicit toolbar or shortcut activation. The content script reads the Selection API and renders a Shadow DOM overlay; the background reads local settings and calls Gemini REST. One background source serves Chromium as a service worker and Firefox as a background script.

**Tech Stack:** Plain JavaScript, HTML, CSS, WebExtensions API, Gemini `generateContent` REST, Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-10-02-gemini-study-helper-design.md`

## Global Constraints

- Support current Chrome, Edge, Cốc Cốc, and Firefox with Manifest V3.
- Top-level selected page text only; never scan the page, form fields, frames, or PDFs.
- Request `activeTab`, `scripting`, `storage`, and Gemini host access only.
- API key resides in `storage.local` and is read only by background code; never log the key, selection, or answer.
- Maximum selection: 8,000 characters. Request timeout: 30 seconds.
- Default model: `gemini-3.8-flash`; allow a valid alternative Gemini model ID.
- Show plain text output in a fixed Shadow DOM overlay; a blocked injection uses an action badge/title.
- No runtime dependencies, analytics, remote scripts, backend, or anti-cheat interaction.
- The directory is not currently a Git repository, so commit steps apply only if a repository is made available; do not initialize Git solely for this plan.

## Review Focus

- Whitespace-only selection must yield a no-selection error without making a network call (Task 1 test).
- A selection beyond 8,000 characters must be rejected before messaging Gemini (Task 1 test).
- Malformed/blocked Gemini responses must show useful errors, not an empty success state (Task 2 test).
- A stale response from an earlier invocation must not replace the current overlay (Task 3 test).
- Page CSS must not change the overlay, and the overlay must allow normal page clicks outside its card (Task 3 manual check).

---

## File map

- `manifest.json`: permissions, action, command, options page, dual background declaration; Firefox loads `src/core.js` before `src/background.js`.
- `src/core.js`: pure validation and Gemini response/error decoding, exposed as `globalThis.ExplainCore` for browser contexts and VM-based tests.
- `src/background.js`: activation, script injection, message validation, settings access, Gemini request.
- `src/content.js`: selection reading, overlay rendering, message request, stale-response guard.
- `options/options.html`, `options/options.js`, `options/options.css`: local key/model management and disclosure.
- `tests/core.test.js`, `tests/background.test.js`, `tests/content.test.js`, `tests/options.test.js`: Node tests with controlled browser/DOM stubs where needed.
- `README.md`: setup, use, permissions, manual browser checks, and limits.

### Task 1: Manifest and selection contract

**Files:** Create `manifest.json`, `src/core.js`, `tests/core.test.js`.

**Interfaces:**
- Produces `ExplainCore.normalizeSelection(raw: unknown): {ok: true, text: string} | {ok: false, code: 'NO_SELECTION' | 'TOO_LONG'}`.
- Produces `ExplainCore.validModel(model: unknown): boolean`, accepting Gemini model IDs matching `^[A-Za-z0-9][A-Za-z0-9._-]*$` and at most 100 characters.
- Produces `ExplainCore.DEFAULT_MODEL` equal to `gemini-3.8-flash`.

- [ ] **Step 1: Write failing tests** in `tests/core.test.js` for trimming, whitespace-only rejection, 8,000-character acceptance, 8,001-character rejection, and model validation.
- [ ] **Step 2: Run `node --test tests/core.test.js`** and confirm failure because the core interface is absent.
- [ ] **Step 3: Implement `src/core.js` and `manifest.json`** with the exact permissions and command from the spec. Use `src/background.js` as Chromium's service worker and `['src/core.js', 'src/background.js']` as Firefox's background scripts.
- [ ] **Step 4: Run `node --test tests/core.test.js`** and confirm all cases pass. Validate manifest JSON with `node -e "JSON.parse(require('fs').readFileSync('manifest.json'))"`.
- [ ] **Step 5: Commit these files if Git is available.**

### Task 2: Background activation and Gemini transport

**Files:** Create `src/background.js`, `tests/background.test.js`; modify `manifest.json` only if script loading requires it.

**Interfaces:**
- Consumes `ExplainCore.normalizeSelection`, `ExplainCore.validModel`, and `ExplainCore.DEFAULT_MODEL`.
- Produces a listener for `{type: 'EXPLAIN_SELECTION', text: string}` returning `{ok: true, text: string} | {ok: false, code: string, message: string}`.
- Internally uses `requestExplanation(text: string, key: string, model: string, fetchImpl: typeof fetch): Promise<string>` to call `POST /v1beta/models/{model}:generateContent` with `x-goog-api-key` and a 30-second abort signal.

- [ ] **Step 1: Write failing tests** for exact request host/path/header/body, missing key, invalid model, empty output, invalid key response, rate limit response, malformed JSON, timeout, and messages from non-extension senders. Mock fetch and storage; assert no network call on invalid input.
- [ ] **Step 2: Run `node --test tests/background.test.js`** and confirm expected missing-interface failures.
- [ ] **Step 3: Implement `src/background.js`** with `importScripts('core.js')` only in the service worker context, toolbar and `Alt+Q` command listeners, `scripting.executeScript` targeting the main frame, runtime message handling, local settings reads, and Gemini transport. Show an action badge/title when injection fails. Clear the badge on a later successful activation.
- [ ] **Step 4: Run `node --test tests/background.test.js`** and confirm all cases pass.
- [ ] **Step 5: Commit these files if Git is available.**

### Task 3: Selection overlay

**Files:** Create `src/content.js`, `tests/content.test.js`.

**Interfaces:**
- Consumes the background response contract from Task 2.
- An injection invokes content code once; repeated injections replace the current overlay without duplicating hosts. Use a request sequence number to discard older results.

- [ ] **Step 1: Write failing tests** for reading `window.getSelection()` once, empty/long selection messaging, loading/result/error states, close action, repeated invocation, stale response rejection, and `textContent` rendering of HTML-like AI output.
- [ ] **Step 2: Run `node --test tests/content.test.js`** and confirm expected missing-script failures.
- [ ] **Step 3: Implement `src/content.js`** as a re-injectable IIFE with a fixed Shadow DOM overlay, viewport sizing, `pointer-events` split, and plain-text rendering. Keep the CSS inside the Shadow Root.
- [ ] **Step 4: Run `node --test tests/content.test.js`** and confirm all cases pass. Inspect overlay manually on a normal page for CSS isolation and click-through outside the card.
- [ ] **Step 5: Commit these files if Git is available.**

### Task 4: Options and delivery

**Files:** Create `options/options.html`, `options/options.js`, `options/options.css`, `tests/options.test.js`, `README.md`.

**Interfaces:**
- Consumes `ExplainCore.validModel` and `ExplainCore.DEFAULT_MODEL`.
- Stores `{geminiApiKey: string, geminiModel: string}` in `storage.local`; deleting the key removes `geminiApiKey`.

- [ ] **Step 1: Write failing tests** for saving a trimmed key/model, rejecting an invalid model, showing saved-key status without echoing it, and deleting the key.
- [ ] **Step 2: Run `node --test tests/options.test.js`** and confirm expected missing-page/controller failures.
- [ ] **Step 3: Implement options files** with clear save/delete feedback, a password input, and text explaining that selected content goes to Google and client-held keys are inspectable. Add `README.md` with installation for Chromium and Firefox, shortcut setup, permitted use, key restrictions, and unsupported pages.
- [ ] **Step 4: Run `node --test tests/*.test.js`** and confirm all tests pass. Manually load unpacked in current Chromium and Firefox and check the flow in the spec; record which browsers and live API states could not be exercised.
- [ ] **Step 5: Commit these files if Git is available.**

## Final verification

- [ ] Run `node --test tests/*.test.js` and confirm no failures.
- [ ] Parse `manifest.json` and check all referenced local files exist.
- [ ] Review requested permissions and search for key/selection logging.
- [ ] Report exact manual-browser and live-Gemini coverage, including any environment limitations.
