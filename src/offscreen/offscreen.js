import {
  FilesetResolver,
  FaceDetector,
} from "../vendor/mediapipe/vision_bundle.mjs";

const AREA_THRESHOLD = 0.02;
const MIN_SCORE_FOR_SELFPROMO = 0.7;
const MIN_DETECTION_CONFIDENCE = 0.5;
const MAX_FACES_FOR_SELFPROMO = 2;
const VERBOSE = true;

let detectorPromise = null;

function getDetector() {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const fileset = await FilesetResolver.forVisionTasks(
        chrome.runtime.getURL("src/vendor/mediapipe/wasm"),
      );
      return FaceDetector.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: chrome.runtime.getURL(
            "assets/models/blaze_face_short_range.tflite",
          ),
        },
        runningMode: "IMAGE",
        minDetectionConfidence: MIN_DETECTION_CONFIDENCE,
      });
    })();
  }
  return detectorPromise;
}

async function classifyUrl(url) {
  const detector = await getDetector();
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);
  try {
    const { detections } = detector.detect(bitmap);
    const total = bitmap.width * bitmap.height;
    const perFace = detections.map((d) => {
      const b = d.boundingBox;
      const score = d.categories?.[0]?.score ?? 0;
      const area = b ? (b.width * b.height) / total : 0;
      return { area: +area.toFixed(4), score: +score.toFixed(3) };
    });
    const largest = perFace.reduce(
      (m, f) => (f.area > m.area ? f : m),
      { area: 0, score: 0 },
    );
    const isSelfPromo =
      detections.length >= 1 &&
      detections.length <= MAX_FACES_FOR_SELFPROMO &&
      largest.score >= MIN_SCORE_FOR_SELFPROMO &&
      largest.area >= AREA_THRESHOLD;
    const result = {
      label: isSelfPromo ? "selfpromotional_image" : "other",
      faces: detections.length,
      largestArea: +largest.area.toFixed(4),
      largestScore: +largest.score.toFixed(3),
      bitmapW: bitmap.width,
      bitmapH: bitmap.height,
      perFace,
    };
    if (VERBOSE) {
      console.log(
        "[unhumbled-offscreen] classify",
        JSON.stringify(result),
        url.slice(0, 80),
      );
    }
    return result;
  } finally {
    bitmap.close();
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "offscreen:classify") return;
  classifyUrl(msg.url)
    .then((result) => sendResponse({ ok: true, ...result }))
    .catch((err) => sendResponse({ ok: false, error: String(err) }));
  return true;
});
