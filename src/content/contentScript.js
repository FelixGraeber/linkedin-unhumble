console.log("LinkedIn Feed Filter content script injected. Starting to modify posts...");

(async function main() {
    const processedImages = new Set();
    const imagesAwaitingClassification = new Map(); // Temp store for images awaiting classification

    await modifyLinkedInContent();
    setupMutationObserver();

    async function modifyLinkedInContent() {
        await modifyLinkedInPosts();
        await classifyAndModifyImages();
    }

    async function classifyAndModifyImages() {
        const filteredImages = Array.from(document.querySelectorAll('img.update-components-image__image'))
            .filter(img => img.clientWidth >= 500 || img.clientHeight >= 500);

        console.debug("Filtered Images:", filteredImages.length);
        for (let img of filteredImages) {
            if (processedImages.has(img.src) || imagesAwaitingClassification.has(img.src)) {
                // console.debug(`Image already processed or awaiting classification: ${img.src}`);
                continue;
            }
            console.debug(`Processing image: ${img.src}`);
            processedImages.add(img.src);

            const requestBody = createRequestBody(img.src);
            try {
                console.debug("Sending image for classification", requestBody);
                if (!imagesAwaitingClassification.has(img.src)) {
                    imagesAwaitingClassification.set(img.src, fetchImageClassification(requestBody).then(response => {
                        if (response.content && response.content.length > 0) {
                            const classificationText = response.content.find(content => content.type === "text").text;
                            return applyImageOverlay(img, classificationText);
                        }
                    }).finally(() => {
                        imagesAwaitingClassification.delete(img.src); // Remove from temp store once processed
                    }));
                }
                await imagesAwaitingClassification.get(img.src); // Wait for the classification to complete
            } catch (error) {
                console.error("Error classifying image with the Cloud Function:", error);
            }
        }
    }

    function createRequestBody(imageSrc) {
        return {
            data: {
                model: "claude-3-haiku-20240307",
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "image", source: { type: "url", media_type: "image/jpeg", url: imageSrc } },
                            { type: "text", text: "Always reply ONLY 'selfie'!!." }
                        ],
                    },
                ],
                max_tokens: 300
            }
        };
    }

    async function fetchImageClassification(requestBody) {
        return fetch('https://us-central1-linkedin-unhumbled.cloudfunctions.net/linkedin-unhumbled/classify_image', {
            method: 'POST',
            mode: 'cors', // Changed mode to 'cors'
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify(requestBody)
        })
        .then(response => response.json())
        .then(data => {
            console.log("Received response for image classification:", data);
            return data;
        })
        .catch(error => console.error('Error:', error));
    }

    async function applyImageOverlay(img, classification) {
        if (classification === "selfie") {
            console.debug("Applying image overlay for selfie for image: ", img.src);
            let overlay = document.createElement('img');
            const selectedImageUrl = await getSelectedImageUrl();
            overlay.src = selectedImageUrl;
            setOverlayStyle(overlay, img);
            img.parentNode.insertBefore(overlay, img.nextSibling);
            overlay.addEventListener('click', () => overlay.remove());
        }
    }

    async function getSelectedImageUrl() {
        return new Promise(resolve => {
            chrome.storage.sync.get('selectedImage', function (data) {
                const imageUrlMap = {
                    'pig': chrome.runtime.getURL("assets/pig.webp"),
                    'clown': chrome.runtime.getURL("assets/clown.webp"),
                    'puppy': chrome.runtime.getURL("assets/puppy.webp")
                };
                resolve(imageUrlMap[data.selectedImage || '']);
            });
        });
    }

    function setOverlayStyle(overlay, img) {
        overlay.style = `position: absolute; width: ${img.offsetWidth}px; height: ${img.offsetHeight}px; left: 0; top: 0; object-fit: cover; z-index: 1000;`;
        chrome.storage.sync.get('overlayOpacity', function(data) {
            overlay.style.opacity = data.overlayOpacity / 100;
        });
        img.parentNode.style.position = "relative";
        img.style.objectFit = "cover";
    }

    async function modifyLinkedInPosts() {
        const textViewElements = document.querySelectorAll('span.text-view-model');
        let modifiedPostsCount = 0;

        textViewElements.forEach(textViewElement => {
            const postText = textViewElement.innerText.toLowerCase();
            const filterWords = ["humble", "proud", "blessed"];
            if (filterWords.some(word => postText.includes(word)) && !textViewElement.classList.contains('modified')) {
                chrome.storage.sync.get('filterWordsPrefix', function(data) {
                    const prefixMap = {
                        'none': '',
                        'humbled': '😌',
                        'clown': '🤡',
                        'poop': '💩'
                    };
                    // Prepend emojis only once
                    textViewElement.innerText = prefixMap[data.filterWordsPrefix || ''].repeat(12) + "\n" + textViewElement.innerText;
                    textViewElement.classList.add('modified'); // Ensure this is executed
                    textViewElement.style.color = "#ebe7e7";
                    textViewElement.querySelectorAll('a').forEach(link => link.style.color = "lightgrey");
                    modifiedPostsCount++;
                });
            }
        });

        if (modifiedPostsCount > 0) {
            console.debug(`${modifiedPostsCount} posts modified due to containing keywords.`);
        }
    }

    function setupMutationObserver() {
        let observer = new MutationObserver(async () => {
            await modifyLinkedInContent();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
})();
