# Security

## Reporting a vulnerability

Please **do not** file a public GitHub issue for security problems.

Email the maintainer directly or use [GitHub private vulnerability reports](https://github.com/FelixGraeber/linkedin-unhumble/security/advisories/new). You should expect an acknowledgement within a few days.

When reporting, include:
- The affected version (`manifest.json` `version` field, or commit hash)
- Reproduction steps
- Impact assessment if you have one

## Threat model

LinkedIn unhumbled is a content-modifying browser extension. Its threat model is shaped by Chrome's Manifest V3 sandbox.

| Asset | Concern | Mitigation |
|---|---|---|
| User credentials, cookies | Extension never reads them | Content script only mutates DOM in the isolated world; no `cookies` permission requested |
| User browsing history | Extension does not collect or transmit it | No `history`, `tabs`, or analytics; `webNavigation`/`tabs` permissions are not requested |
| Image URLs from the user's feed | Sent to the offscreen document for face detection | URLs never leave the user's device — no network egress to anywhere except `media.licdn.com` (LinkedIn's own image CDN) |
| User preferences | Stored in `chrome.storage.sync` (Google account sync) | Limited to filter words, dog GIF choice, prefix emoji — no PII |
| Vendored ML model + WASM | Could be tampered with at distribution | Files are committed in-tree; integrity is whatever the git hosting and Web Store packaging guarantee |

## Permissions

| Permission | Why |
|---|---|
| `storage` | Persist user-selected filter words, prefix emoji, and dog GIF choice |
| `offscreen` | Run MediaPipe WASM inference outside the service worker (service workers cannot host long-lived WASM modules reliably) |
| `host_permissions: https://*.linkedin.com/*` | Run the content script on LinkedIn pages |
| `host_permissions: https://*.licdn.com/*` | Allow the offscreen document to fetch a feed image for face detection |

## Content Security Policy

`extension_pages` CSP is `script-src 'self' 'wasm-unsafe-eval'; object-src 'self'`.

`'wasm-unsafe-eval'` is required by MediaPipe's Emscripten-generated WebAssembly loader. We do **not** allow remote scripts, eval of strings, or remote WASM. All vendored WASM is bundled in the extension under `src/vendor/mediapipe/wasm/`.

## What we do not do

- No remote code execution. No `eval`, no `new Function`, no remote `<script>` injection.
- No telemetry. No analytics. No crash reporting.
- No third-party network calls. The cloud classifier (previously a Google Cloud Function calling OpenAI) was removed; classification is on-device.
- No reading from other extension origins, no cross-origin DOM access.
- No background tracking when LinkedIn is not open.

## Known limitations

- **WebAssembly memory unsafety.** MediaPipe's BlazeFace runs in a WASM sandbox. Within that sandbox, memory bugs in the bundled C++ are constrained but not eliminated. Updates to `@mediapipe/tasks-vision` should be picked up periodically.
- **DOM-based selectors.** Content-script DOM manipulation depends on LinkedIn's HTML structure. LinkedIn periodically rotates CSS class names; selectors fall back to URL patterns and `[role="listitem"]` to stay robust, but breakage is possible.
- **`chrome.runtime` message origin.** Within an MV3 extension, message senders are implicitly the same extension; we do not validate sender IDs because the worker accepts no external messages.

## Supply-chain note

Vendored: `@mediapipe/tasks-vision@0.10.35` and the `blaze_face_short_range.tflite` model from `storage.googleapis.com/mediapipe-models/...`. Both are reproducibly downloadable. See `NOTICE` for attribution.

We do **not** use a CDN at runtime. The extension ships everything it needs; your browser does not phone home for assets.
