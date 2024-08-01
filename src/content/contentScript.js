console.log("LinkedIn Feed Filter content script injected. Starting to modify posts...");

(async function main() {
    const processedImages = new Set();
    const imagesAwaitingClassification = new Map();
    const processedTextElements = new Set();

    // Load storage data at the beginning
    console.log("Starting to load storage data...");
    const filterWords = await loadStorageData('filterWords');
    console.log("Loaded filterWords:", filterWords);
    const filterWordsPrefix = await loadStorageData('filterWordsPrefix');
    console.log("Loaded filterWordsPrefix:", filterWordsPrefix);

    // Select the prefix once at the beginning
    const memoizedSelectPrefix = (() => {
        const cache = new Map();
        return (filterWordsPrefix) => {
            if (!cache.has(filterWordsPrefix)) {
                cache.set(filterWordsPrefix, selectPrefix(filterWordsPrefix));
            }
            return cache.get(filterWordsPrefix);
        };
    })();
    const prefix = memoizedSelectPrefix(filterWordsPrefix);
    console.log("Selected prefix:", prefix);

    setupIntersectionObserver();

    function selectPrefix(filterWordsPrefix) {
        switch (filterWordsPrefix) {
            case 'humbled': return '😌';
            case 'clown': return '🤡';
            case 'poop': return '💩';
            default: return '';
        }
    }

    async function modifyLinkedInPosts() {
        const textViewElements = document.querySelectorAll(`
            .comments-comment-entity,
            .update-components-actor__description,
            .update-components-text.update-components-update-v2__commentary,
            .update-components-article__title,
            .update-components-article__subtitle-ellipsis,
            .comments-comment-item__main-content.feed-shared-main-content--comment,
            .comments-comment-meta__description-subtitle
        `);

        const filterWordsSet = new Set(filterWords.map(word => word.toLowerCase()));

        for (const textViewElement of textViewElements) {
            if (processedTextElements.has(textViewElement)) continue;

            const postText = textViewElement.innerText.toLowerCase();
            const matchedWord = Array.from(filterWordsSet).find(word => postText.includes(word));
            
            if (matchedWord && !textViewElement.classList.contains('modified')) {
                console.log(`Matched filter word: "${matchedWord}" in post:`, postText);
                textViewElement.innerText = prefix.repeat(13) + '\n' + textViewElement.innerText;
                textViewElement.style.color = "#ebe7e7";
                textViewElement.classList.add('modified');
                textViewElement.querySelectorAll('a').forEach(link => link.style.color = "lightgrey");
                processedTextElements.add(textViewElement);
            }
        }
    }

    async function classifyAndModifyImages() {
        const selectedImages = Array.from(document.querySelectorAll('img.update-components-image__image'))
            .filter(img => img.clientWidth >= 100 || img.clientHeight >= 100)
            .filter(img => !processedImages.has(img.src) && !imagesAwaitingClassification.has(img.src));

        console.debug("Filtered Images:", selectedImages.length);

        const classificationPromises = selectedImages.map(async (img) => {
            processedImages.add(img.src);
            const requestBody = createRequestBody(img.src);
            try {
                const classificationPromise = fetchImageClassification(requestBody);
                imagesAwaitingClassification.set(img.src, classificationPromise);
                const response = await classificationPromise;
                if (response && response.classification) {
                    await applyImageOverlay(img, response.classification);
                }
            } catch (error) {
                console.error("Error classifying image:", error);
            } finally {
                imagesAwaitingClassification.delete(img.src);
            }
        });

        await Promise.all(classificationPromises);
    }

    function createRequestBody(imageSrc) {
        if (!imageSrc) {
            console.error("No image source provided to createRequestBody");
            return null;
        }
        console.debug("Creating request body for image:", imageSrc);
        const requestBody = {
            data: {
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: "ONLY RESPOND WITH THE CLASSIFICATION 'selfpromotional_image' OR 'other': You are an AI that detects self-promotional LinkedIn images. Classify the following image as either 'selfpromotional_image' (selfies, headshots of one person) or 'other' (no people, multiple people, not self-promotional)." },
                            {
                                type: "image_url",
                                image_url: {
                                    url: imageSrc
                                }
                            }
                        ]
                    }
                ]
            },
            max_tokens: 300
        };
        console.debug("Created request body:", JSON.stringify(requestBody, null, 2));
        return requestBody;
    }

    async function fetchImageClassification(requestBody) {
        try {
            console.log("Sending request body:", JSON.stringify(requestBody, null, 2));
            
            const response = await fetch('https://us-central1-linkedin-unhumbled.cloudfunctions.net/linkedin-unhumbled/classify_image', {
                method: 'POST',
                mode: 'cors',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            console.log("Response status:", response.status);
            console.log("Response headers:", JSON.stringify(Object.fromEntries(response.headers), null, 2));

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log("Parsed response for image classification:", data);
            return data;
        } catch (error) {
            console.error("Error in fetchImageClassification:", error);
            throw error;
        }
    }

    async function applyImageOverlay(img, classification) {
        if (classification === "selfpromotional_image") {
            console.debug("Applying image overlay for selfie for image: ", img.src);
            const selectedImageUrl = await getSelectedImageUrl();
            let overlay = document.createElement('img');
            overlay.src = selectedImageUrl;
            setOverlayStyle(overlay, img);
            img.parentNode.insertBefore(overlay, img.nextSibling);
            console.log("Overlay inserted:", overlay);
            overlay.style.transition = "opacity 2s"; // Set transition for opacity change
            overlay.style.opacity = 0; // Start with the overlay hidden
            setTimeout(() => overlay.style.opacity = 0.69, 2000); // Fade in the overlay over 2 seconds to the final opacity from settings
            overlay.addEventListener('click', () => overlay.remove());
        }
    }

    async function getSelectedImageUrl() {
        return new Promise(resolve => {
            chrome.storage.sync.get('selectedImage', function (data) {
                const imageUrlMap = {
                    'dog_gif': chrome.runtime.getURL("assets/dog.gif"),
                    'dog_static': chrome.runtime.getURL("assets/dog_static.png")
                };
                resolve(imageUrlMap[data.selectedImage || '']);
            });
        });
    }
    
    function setOverlayStyle(overlay, img) {
        overlay.style = `position: absolute; width: ${img.offsetWidth}px; height: ${img.offsetHeight}px; left: 0; top: 0; object-fit: cover; z-index: 1000;`;
        overlay.style.opacity = 0.69;
        img.parentNode.style.position = "relative";
        img.style.objectFit = "cover";
        console.log("Overlay style applied:", overlay.style);
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    function setupIntersectionObserver() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    modifyLinkedInContent();
                }
            });
        }, { rootMargin: '100px' });

        observer.observe(document.querySelector('#main-feed') || document.body);
    }
    
    async function loadStorageData(key) {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.get(key, function(data) {
                if (chrome.runtime.lastError) {
                    console.error(`Error loading ${key}:`, chrome.runtime.lastError);
                    reject(chrome.runtime.lastError);
                } else {
                    let result = data[key];
                    console.log(`Loaded ${key}:`, result);
                    if (key === 'filterWordsPrefix') {
                        // For filterWordsPrefix, we expect a single string value
                        resolve(result || '');
                    } else if (typeof result === 'string') {
                        // For other keys, split string into array if necessary
                        resolve(result.split(',').map(item => item.trim()));
                    } else {
                        resolve(result || []);
                    }
                }
            });
        });
    }    

    async function modifyLinkedInContent() {
        await modifyLinkedInPosts();
        await classifyAndModifyImages();
    }
})();