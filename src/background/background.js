const OFFSCREEN_URL = "src/offscreen/offscreen.html";
const CACHE_LIMIT = 500;
const classificationCache = new Map();

chrome.runtime.onInstalled.addListener(function (details) {
  if (details.reason == "install") {
    chrome.tabs.create({ url: "src/settings/settings.html" });
  }
});

let creatingOffscreen = null;
async function ensureOffscreen() {
  const url = chrome.runtime.getURL(OFFSCREEN_URL);
  const existing = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [url],
  });
  if (existing.length > 0) return;
  if (!creatingOffscreen) {
    creatingOffscreen = chrome.offscreen
      .createDocument({
        url: OFFSCREEN_URL,
        reasons: ["DOM_PARSER"],
        justification:
          "Run on-device image classification with MediaPipe FaceDetector.",
      })
      .finally(() => {
        creatingOffscreen = null;
      });
  }
  await creatingOffscreen;
}

function cacheGet(url) {
  if (!classificationCache.has(url)) return undefined;
  const value = classificationCache.get(url);
  classificationCache.delete(url);
  classificationCache.set(url, value);
  return value;
}

function cacheSet(url, value) {
  if (classificationCache.has(url)) classificationCache.delete(url);
  classificationCache.set(url, value);
  if (classificationCache.size > CACHE_LIMIT) {
    const oldest = classificationCache.keys().next().value;
    classificationCache.delete(oldest);
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "classifyImage") return;
  const url = msg.url;
  if (!url) {
    sendResponse({ ok: false, error: "missing url" });
    return;
  }
  const cached = cacheGet(url);
  if (cached) {
    sendResponse(cached);
    return;
  }
  (async () => {
    try {
      await ensureOffscreen();
      const result = await chrome.runtime.sendMessage({
        type: "offscreen:classify",
        url,
      });
      if (result?.ok) cacheSet(url, result);
      sendResponse(result ?? { ok: false, error: "no response" });
    } catch (err) {
      sendResponse({ ok: false, error: String(err) });
    }
  })();
  return true;
});
