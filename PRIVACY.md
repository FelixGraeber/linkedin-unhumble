# privacy

short version: nothing about you ever leaves your browser.

## what we collect

nothing.

## what we send to a server

nothing.

the only outbound fetches go to linkedin's own image cdn (`media.licdn.com`, `static.licdn.com`) for images already loading on the page you're viewing. no analytics, no crash reporters, no ads, no telemetry.

## what's stored locally

`chrome.storage.sync` holds three keys:

| key | value | purpose |
|---|---|---|
| `filterWords` | comma-separated words (default: `humbled, proud, blessed, thrilled`) | which words trigger the prefix |
| `filterWordsPrefix` | `none` / `humbled` / `clown` / `poop` | which emoji to inject |
| `selectedImage` | `dog_gif` / `dog_static` | which dog asset to overlay |

if chrome sync is on, those settings sync via your google account. no pii in any of them.

## image classification

while you scroll:

- content script spots post images by url pattern (`feedshare-shrink_*`, `image-shrink_*`)
- offscreen page fetches the bytes from linkedin's cdn
- decodes locally, runs mediapipe blazeface in webassembly
- result (face count, confidence, bbox area) lives in memory just long enough to decide whether the dog overlays
- nothing is logged, sent, or persisted

## permissions

see [security.md](SECURITY.md). notable absences: no `tabs`, `cookies`, `history`, `identity`, `webRequest`.

## third parties

| party | what they get |
|---|---|
| linkedin / microsoft | the fact that your browser is loading their pages — which they already see anyway |
| google (sync) | your three `chrome.storage.sync` keys above, if sync is on |
| the maintainer | nothing |

## changes

substantive changes get a version bump in `manifest.json` and a note in the commit history.
