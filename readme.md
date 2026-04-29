# LinkedIn unhumbled

Make LinkedIn bearable again. Injects clown emojis into "humbled" and "proud" posts; overlays the confused-dog GIF on self-promotional headshots. On-device only — image classification runs locally via MediaPipe BlazeFace, no network calls per post.

## Build the Web Store zip

```sh
rm -f linkedin-unhumbled.zip && zip -r linkedin-unhumbled.zip . \
  -x "*/screenshots/*" "*.zip" "*.git*" ".git/*" "*.DS_Store" "*/.DS_Store" \
     "*/old/*" "*/00 Old/*" "readme.md"
```
