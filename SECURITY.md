# security

## reporting

don't open a public issue for vulns. use [github private vulnerability reports](https://github.com/FelixGraeber/linkedin-unhumble/security/advisories/new) or email the maintainer. expect a reply within a few days.

include the version (from `manifest.json`) or commit hash, repro steps, and your impact assessment if you have one.

## threat model

it's a content extension running in chrome's mv3 sandbox.

- credentials and cookies: never read. no `cookies` permission.
- browsing history: not collected, not transmitted. no `history`/`tabs`/analytics.
- image urls from your feed: passed through the offscreen doc for face detection. they don't leave your device. the only network fetch is to `media.licdn.com`, linkedin's own cdn.
- preferences in `chrome.storage.sync`: filter words, dog choice, prefix emoji. no pii.
- vendored ml model + wasm: committed in-tree; integrity is whatever git and the web store guarantee.

## permissions

- `storage` — saves your prefs
- `offscreen` — hosts the wasm face detector (service workers can't do that reliably)
- `https://*.linkedin.com/*` — content script needs to run on linkedin
- `https://*.licdn.com/*` — offscreen needs to fetch image bytes for detection

## csp

`script-src 'self' 'wasm-unsafe-eval'; object-src 'self'`.

`wasm-unsafe-eval` is required by mediapipe's emscripten loader. no remote scripts. no remote wasm. no `eval` of strings.

## what we don't do

- no remote code execution
- no telemetry, analytics, or crash reporting
- no third-party network calls (the gpt-4o-mini cloud function was removed)
- no cross-origin reads
- no background tracking when linkedin is closed

## known limits

- **wasm sandbox.** mediapipe's c++ runs in wasm. memory bugs are constrained, not eliminated. bump `@mediapipe/tasks-vision` periodically.
- **dom selectors.** linkedin rotates css class names. selectors fall back to url patterns and `[role="listitem"]` but breakage happens.
- **message origin.** mv3 message senders are implicitly the same extension; sender ids aren't validated because no external messages are accepted.

## supply chain

vendored `@mediapipe/tasks-vision@0.10.35` and `blaze_face_short_range.tflite` from google's mediapipe assets. both reproducibly downloadable. see [notice](NOTICE).

no runtime cdn. the extension ships everything; your browser doesn't phone home for assets.
