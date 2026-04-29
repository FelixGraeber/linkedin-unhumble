# Contributing

Thanks for helping fix LinkedIn.

## Local development

The extension is plain JavaScript with vendored MediaPipe — no build step, no `node_modules`.

1. Clone the repo.
2. Open `chrome://extensions` in Chrome.
3. Toggle **Developer mode** (top right).
4. Click **Load unpacked** and pick this repository's root directory.
5. Visit `linkedin.com/feed/` to test.

After editing files:
- Code changes take effect on the next page reload (or after pressing the **Reload** button on the extension card in `chrome://extensions`).
- Manifest or vendored-asset changes require an extension reload.

## Debug logging

`src/content/contentScript.js` and `src/offscreen/offscreen.js` define `DEBUG`/`VERBOSE`-style flags at the top of each file. Flip them to `true` while developing. Default is silent in production.

## Project layout

```
manifest.json                      MV3 manifest
src/
  background/background.js         Service worker: routes classify messages, owns LRU cache, owns offscreen doc lifecycle
  content/contentScript.js         Runs on linkedin.com: finds post text + images, sends classify requests, applies overlays
  offscreen/offscreen.{html,js}    Long-lived host for MediaPipe BlazeFace (service workers cannot host WASM reliably)
  popup/                           Extension toolbar popup (links to settings)
  settings/                        Options page
  vendor/mediapipe/                Vendored @mediapipe/tasks-vision 0.10.35 (Apache 2.0; do not edit)
assets/
  dog.gif, dog_static.png          Overlay assets
  models/blaze_face_short_range.tflite   Bundled MediaPipe model (Apache 2.0)
  icons/                           Extension icons
```

## Architecture

A classification request flows:

```
linkedin.com page
   └─> content script (isolated world)
         └─ chrome.runtime.sendMessage({type: 'classifyImage', url})
              └─> service worker (background.js)
                    ├─ LRU cache hit? return cached label
                    └─ ensureOffscreen() then forward to offscreen
                          └─> offscreen document (offscreen.js)
                                ├─ getDetector() lazy-loads MediaPipe + BlazeFace once
                                ├─ fetch(url) → blob → createImageBitmap
                                ├─ detector.detect(bitmap)
                                └─ reply with {ok, label, faces, largestArea, largestScore}
```

If the label is `selfpromotional_image`, the content script overlays the chosen dog asset on top of the original image.

## Conventions

- **No comments** unless they capture a non-obvious *why* (a hidden constraint, a workaround, an invariant). Don't narrate what the code does.
- **No build step.** Keep the extension loadable as-is from a checkout.
- **Vendored deps** live under `src/vendor/`. Do not edit them; bump versions explicitly and update `NOTICE`.
- **Conventional commit prefixes**: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`. Subject under 72 characters.
- **Atomic commits**: one concern per commit. Use `git add -- path1 path2` to stage explicitly.

## Testing

There is no automated test suite (yet). Manual checklist:

1. Load the unpacked extension on a fresh Chrome profile.
2. Open `linkedin.com/feed/`. Confirm:
   - Posts containing `humbled`, `proud`, `blessed`, or `thrilled` get a clown-emoji prefix and grey text.
   - Single-person headshot images get the dog overlay (50% opacity, fade in over 2s).
   - Group photos, charts, and screenshots are *not* overlaid.
3. Scroll for ~30 seconds. Confirm the extension does not block scrolling or trigger ANRs.
4. Open the Network panel; filter for `cloudfunctions.net` or any other non-LinkedIn origin. There should be zero matches from the extension.

## Building the Web Store zip

```sh
rm -f linkedin-unhumbled.zip && zip -r linkedin-unhumbled.zip . \
  -x "*.git*" ".git/*" "*.zip" \
     "*.DS_Store" "*/.DS_Store" \
     "assets/screenshots/*" \
     "*.md" "LICENSE" "NOTICE" \
     "src/vendor/mediapipe/LICENSE"
```

(The `LICENSE` and `NOTICE` are excluded from the Web Store package because Chrome rejects extension uploads with non-essential text files at the root, but they remain in the repo.)
