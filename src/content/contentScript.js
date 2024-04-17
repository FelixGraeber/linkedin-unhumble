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
        const selectedImages = Array.from(document.querySelectorAll('img.update-components-image__image'))
            .filter(img => img.clientWidth >= 100 || img.clientHeight >= 100);

        console.debug("Filtered Images:", selectedImages.length);
        for (let img of selectedImages) {
            if (processedImages.has(img.src) || imagesAwaitingClassification.has(img.src)) {
                // console.debug(`Image already processed or awaiting classification: ${img.src}`);
                continue;
            }
            console.debug(`Processing image: ${img.src}`);
            processedImages.add(img.src);
            console.debug("Processed images:", processedImages);

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
        chrome.storage.sync.get('overlayOpacity', function (data) {
            overlay.style.opacity = data.overlayOpacity / 100;
        });
        img.parentNode.style.position = "relative";
        img.style.objectFit = "cover";
    }

    // Existing function to modify LinkedIn posts based on text content
    async function modifyLinkedInPosts() {
        let modifiedPostsCount = 0; // Keep track of how many posts were modified
        const textViewElements = document.querySelectorAll('span.text-view-model'); // Select all spans with class 'text-view-model'
        textViewElements.forEach(textViewElement => {
            const postText = textViewElement.innerText.toLowerCase();
            // Check if post contains any of the keywords
            const filterWords = ["humble", "proud", "blessed"]; // Assuming these are the filterWords from settings.html
            if (filterWords.some(word => postText.includes(word)) && !textViewElement.classList.contains('modified')) {
                chrome.storage.sync.get('filterWordsPrefix', function(data) {
                    let prefix;
                    switch (data.filterWordsPrefix) {
                        case 'none':
                            prefix = '';
                            break;
                        case 'humbled':
                            prefix = '😌';
                            break;
                        case 'clown':
                            prefix = '🤡';
                            break;
                        case 'poop':
                            prefix = '💩';
                            break;
                        default:
                            prefix = '';
                    }
                    textViewElement.innerText = prefix.repeat(12) + "\n" + textViewElement.innerText;
                    textViewElement.style.color = "#ebe7e7";
                });
                textViewElement.classList.add('modified'); // Mark the element as modified
                textViewElement.querySelectorAll('a').forEach(link => {
                    link.style.color = "lightgrey";
                });
                modifiedPostsCount++;
            }
        });

        if (modifiedPostsCount > 0) {
            console.log(`${modifiedPostsCount} posts modified to have a light grey background due to containing keywords.`);
        } 
    }

    function getChromeStorage(key) {
        return new Promise(resolve => {
            chrome.storage.sync.get(key, function(data) {
                resolve(data);
            });
        });
    }

    function setupMutationObserver() {
        let observer = new MutationObserver(async () => {
            await modifyLinkedInContent();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
})();
