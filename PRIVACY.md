# Privacy Policy

**Short version: nothing about you ever leaves your browser.**

## What data is collected

None.

## What data is sent to a remote server

None.

The extension does not contact any remote service except LinkedIn's own image CDN (`media.licdn.com` and `static.licdn.com`) to retrieve feed images that are already loaded on the page you are viewing.

There are no analytics SDKs, no crash reporters, no advertising trackers, no telemetry of any kind.

## What is stored locally

In `chrome.storage.sync`, the extension stores:

| Key | Value | Purpose |
|---|---|---|
| `filterWords` | Comma-separated user-edited words (default: `humbled, proud, blessed, thrilled`) | Which words trigger the emoji prefix on a post |
| `filterWordsPrefix` | One of `none`, `humbled`, `clown`, `poop` | Which emoji to inject |
| `selectedImage` | One of `dog_gif`, `dog_static` | Which dog asset to overlay |

`chrome.storage.sync` is synced across the user's Chrome installations via the user's Google account, when sync is enabled. The values above contain no personal information.

## Image classification

When you scroll the LinkedIn feed, the extension's content script identifies post images by URL pattern (`feedshare-shrink_*`, `image-shrink_*`) and asks the extension's offscreen document to classify them. Classification runs locally in WebAssembly using a bundled MediaPipe BlazeFace model.

- The image bytes are fetched from LinkedIn's CDN (`media.licdn.com`) by the extension.
- The fetched bytes are decoded into an `ImageBitmap` and run through the on-device face detector.
- The result (face count, confidence, bbox area) is held in memory only long enough to decide whether to overlay the dog GIF.
- Nothing is logged to disk, sent to a server, or persisted across page loads.

## Permissions

See `SECURITY.md` for the full list and rationale. Notable: no `tabs`, no `cookies`, no `history`, no `identity`, no `webRequest`.

## Third parties

| Party | What they receive |
|---|---|
| LinkedIn / Microsoft | The fact that your browser is loading their pages and images, which they already see independent of this extension |
| Google (sync) | Your `chrome.storage.sync` values, which are limited to the keys above and propagate via Chrome Sync if enabled |
| The maintainer of this repository | Nothing |

## Changes to this policy

Substantive changes will be noted in the changelog and the version bumped. The current policy applies to extension version `1.x.x` and later.
