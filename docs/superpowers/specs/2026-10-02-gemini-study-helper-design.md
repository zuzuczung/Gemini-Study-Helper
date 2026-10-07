# Gemini study helper browser extension — design

## Goal and scope

Build a browser extension for self-study pages and authorized practice environments. A user selects question text and explicitly invokes the extension. The extension sends only that selected text to Gemini and shows a reference explanation on the current page. It does not collect other page content, inspect monitoring systems, or interact with exam controls.

The first release supports current Chromium browsers (Chrome, Edge, Cốc Cốc) and Firefox. It handles text selected in the top-level document only. It does not read text from form fields, cross-origin frames, PDFs, browser-internal pages, or restricted extension pages.

## User flow

1. The user opens the extension's options page and enters their own Gemini API key. They may leave the default model (`gemini-3.8-flash`) or enter another Gemini model ID, then save. They can delete the stored key.
2. On a supported page, the user selects question text and invokes the toolbar action or `Alt+Q` shortcut. The shortcut may be reassigned by the browser or user.
3. The extension injects a content script into the active tab's main frame. The script reads `window.getSelection().toString()` once for that invocation. It trims surrounding whitespace and refuses empty selections or selections above 8,000 characters.
4. The script opens a compact fixed overlay. It shows a loading state, then the explanation or a useful error message. The user can close it. A later invocation replaces the previous result.

## Architecture

- **Manifest V3:** request `activeTab`, `scripting`, and `storage`; declare only `https://generativelanguage.googleapis.com/*` as a remote host permission. Define the toolbar action, options page, and command. Avoid blanket page host permissions and persistent content scripts.
- **Background:** one JavaScript source handles activation, reads settings from extension storage, and makes Gemini REST calls. The manifest lists it as both `background.service_worker` for Chromium and `background.scripts` for Firefox, following Mozilla's cross-browser MV3 guidance. Use feature-compatible extension APIs or a small local adapter; no remote code or runtime SDK.
- **Content script:** injected on demand with `scripting.executeScript`. It owns selection reading and overlay rendering. It checks the focused element to exclude form fields and editable regions, then reads only the Selection API; it does not scan surrounding page content. It sends `{type: "EXPLAIN_SELECTION", text}` through extension messaging and accepts only the background response.
- **Options page:** stores the key and model in `storage.local`. It asks background code whether a key exists rather than reading the stored key back. It does not display a saved key after reload; it shows whether one is saved and offers replacement/deletion. The model ID is validated before storage.
- **Gemini request:** background calls `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` with `x-goog-api-key`, JSON content type, and the selected text inside an instruction that asks for a concise Vietnamese educational explanation and flags uncertainty. Parse text parts from the first usable candidate. Do not persist the selection or result.

## UI and error behavior

The content script creates one host element and attaches an open Shadow Root so page CSS does not style the card. The host uses `position: fixed` and a high z-index. The outside host area uses `pointer-events: none`; the card and its close button use `pointer-events: auto`. Render all user text and AI output with `textContent`, preserving line breaks with CSS. The overlay is responsive, stays within the viewport, and remains until closed or replaced by another invocation.

Show explicit overlay messages for no selection, selection too long, missing key, invalid model, request timeout, API errors (including invalid key and rate limits), and empty model output. If injection is blocked on a restricted page, show an action badge and update the action title because no overlay can be created there. Do not log the key, selection, or response. Limit request time to 30 seconds. New invocations must not let an older response overwrite the newest overlay.

## Key handling and trust boundary

Only the background reads the Gemini key. The content script receives neither the key nor the endpoint request headers. Because the user supplies a key to a client-side extension, it remains inspectable on their own machine; this design does not claim server-side secrecy. The options page tells users to use a Gemini-only restricted key and notes that selected text is sent to Google on invocation. The extension does not use analytics or third-party scripts.

## Verification

- Automated checks cover selection validation, Gemini response/error parsing, message validation, and prevention of stale UI updates where practical without duplicating implementation details.
- Manual checks in current Chromium and Firefox cover toolbar and shortcut activation, selection on a normal HTML page, missing key, malformed/expired key, successful response, closing/replacing the overlay, page CSS isolation, and behavior on restricted pages.
- No live Gemini request is required for automated tests; manual success testing requires a user-provided key.

## Delivery

Ship a loadable unpacked extension and a short README with installation, key setup, usage, permissions, and supported-page limitations. No backend, account system, telemetry, or anti-cheat interaction is included.
