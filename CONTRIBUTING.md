# contributing

thanks for helping fix linkedin.

## dev setup

plain js, no build step, no `node_modules`.

1. clone the repo.
2. open `chrome://extensions`.
3. turn on developer mode.
4. click load unpacked and pick the repo root.
5. visit `linkedin.com/feed/`.

page reload picks up content-script edits. manifest or vendored-asset edits need an extension reload.

## debug

flip `DEBUG` in `src/content/contentScript.js` and `VERBOSE` in `src/offscreen/offscreen.js` to `true` while developing. silent in production.

## layout

```
manifest.json                  mv3 manifest
src/
  background/background.js     service worker — routes messages, lru cache, owns offscreen lifecycle
  content/contentScript.js     runs on linkedin.com — finds posts + images, applies overlays
  offscreen/offscreen.{html,js}  long-lived host for mediapipe blazeface
  popup/                       toolbar popup
  settings/                    options page
  vendor/mediapipe/            vendored @mediapipe/tasks-vision 0.10.35 (don't edit)
assets/
  dog.gif, dog_static.png      overlay assets
  models/blaze_face_short_range.tflite   bundled mediapipe model
  icons/                       extension icons
```

## flow

```
linkedin.com page
   └─> content script (isolated world)
         └─ chrome.runtime.sendMessage({type:'classifyImage', url})
              └─> service worker
                    ├─ lru cache hit? return cached
                    └─ ensure offscreen, forward
                          └─> offscreen
                                ├─ load mediapipe + blazeface once
                                ├─ fetch → imagebitmap → detect
                                └─ reply {ok, label, faces, largestArea, largestScore}
```

if label is `selfpromotional_image`, the content script overlays the dog.

## conventions

- no comments unless explaining a non-obvious *why*
- no build step — keep the extension loadable as-is from a checkout
- vendored deps in `src/vendor/`; don't edit, bump versions and update `NOTICE`
- conventional commit prefixes: `feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`
- atomic commits — one concern per commit

## manual test

no automated suite yet:

1. load unpacked on a clean chrome profile
2. open `linkedin.com/feed/`. confirm:
   - posts with `humbled`/`proud`/`blessed`/`thrilled` get the prefix and greyed text
   - solo-headshot images get the dog overlay (50% opacity, fade in)
   - group photos, charts, screenshots are not overlaid
3. scroll for ~30s. no jank, no anrs.
4. devtools network panel: filter for `cloudfunctions.net` or any non-linkedin origin. zero matches from the extension.

## build the web store zip

```sh
rm -f linkedin-unhumbled.zip && zip -r linkedin-unhumbled.zip . \
  -x ".git/*" "*.git*" "*.zip" \
     "*.DS_Store" "*/.DS_Store" \
     "assets/screenshots/*" "*.mov"
```
