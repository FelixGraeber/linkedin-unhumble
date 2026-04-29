const DEBUG = false;

function log(...args) {
    if (DEBUG) console.log(...args);
}

(async function main() {
    const POST_TEXT_MIN_LENGTH = 60;
    const DEFAULT_FILTER_WORDS = ['humbled', 'proud', 'blessed', 'thrilled'];
    const DEFAULT_PREFIX = 'clown';
    const PREFIX_EMOJI = { humbled: '😌', clown: '🤡', poop: '💩', none: '' };
    const OVERLAY_ASSET = { dog_gif: 'assets/dog.gif', dog_static: 'assets/dog_static.png' };

    const processedImages = new Set();
    const processedTextElements = new Set();

    const stored = await chrome.storage.sync.get(['filterWords', 'filterWordsPrefix', 'selectedImage']);

    const parsedFilterWords = typeof stored.filterWords === 'string'
        ? stored.filterWords.split(',').map(s => s.trim()).filter(Boolean)
        : Array.isArray(stored.filterWords) ? stored.filterWords : [];
    const filterWords = parsedFilterWords.length ? parsedFilterWords : DEFAULT_FILTER_WORDS;
    const filterWordsSet = new Set(filterWords.map(w => w.toLowerCase()));

    const prefix = PREFIX_EMOJI[stored.filterWordsPrefix || DEFAULT_PREFIX] ?? '';
    const overlayUrl = chrome.runtime.getURL(OVERLAY_ASSET[stored.selectedImage] || OVERLAY_ASSET.dog_gif);

    log("Init", { filterWords, prefix, overlayUrl });

    setupMutationObserver();

    async function modifyLinkedInPosts() {
        const elements = document.querySelectorAll('main [role="listitem"] p');
        for (const el of elements) {
            if (processedTextElements.has(el)) continue;
            if (el.classList.contains('modified')) continue;

            const txt = el.textContent;
            if (txt.length < POST_TEXT_MIN_LENGTH) continue;

            const lower = txt.toLowerCase();
            let match;
            for (const w of filterWordsSet) {
                if (lower.includes(w)) { match = w; break; }
            }
            if (!match) continue;

            log(`Matched "${match}" in post:`, txt);
            el.innerText = prefix.repeat(13) + '\n' + el.innerText;
            el.style.color = "#888";
            el.classList.add('modified');
            el.querySelectorAll('a').forEach(link => link.style.color = "#666");
            processedTextElements.add(el);
        }
    }

    async function classifyAndModifyImages() {
        const candidates = Array.from(document.querySelectorAll(
            'img[src*="/feedshare-shrink_"], img[src*="/image-shrink_"]'
        )).filter(img =>
            (img.clientWidth >= 100 || img.clientHeight >= 100) &&
            !processedImages.has(img.src)
        );

        if (!candidates.length) return;
        log("ClassifyTick", { candidates: candidates.length, processed: processedImages.size });

        await Promise.all(candidates.map(async img => {
            processedImages.add(img.src);
            try {
                const response = await chrome.runtime.sendMessage({ type: 'classifyImage', url: img.src });
                if (response?.ok) {
                    log("Classified", img.src, response);
                    if (response.label === 'selfpromotional_image') applyImageOverlay(img);
                } else {
                    log("Classification error:", response?.error);
                }
            } catch (e) {
                log("Error classifying image:", e);
            }
        }));
    }

    function applyImageOverlay(img) {
        const overlay = document.createElement('img');
        overlay.src = overlayUrl;
        overlay.style.cssText =
            `position:absolute;width:${img.offsetWidth}px;height:${img.offsetHeight}px;` +
            `left:0;top:0;object-fit:cover;z-index:1000;opacity:0.5;transition:opacity 2s;`;
        img.parentNode.style.position = 'relative';
        img.style.objectFit = 'cover';
        img.parentNode.insertBefore(overlay, img.nextSibling);
        overlay.addEventListener('click', () => overlay.remove());
        requestAnimationFrame(() => { overlay.style.opacity = '0'; });
        setTimeout(() => { overlay.style.opacity = '0.5'; }, 2000);
    }

    function debounce(func, wait) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
        };
    }

    function setupMutationObserver() {
        const debounced = debounce(modifyLinkedInContent, 250);
        const observer = new MutationObserver(mutations => {
            if (mutations.some(m => m.type === 'childList' && m.addedNodes.length > 0)) {
                debounced();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    async function modifyLinkedInContent() {
        await modifyLinkedInPosts();
        await classifyAndModifyImages();
    }
})();
