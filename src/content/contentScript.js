console.log("LinkedIn Feed Filter content script injected. Starting to modify posts...");

(async function () {
    chrome.storage.sync.get('apiKey', async function (data) {
        const apiKey = data.apiKey; // Get API key from storage
        console.debug("API Key retrieved:", apiKey); // Debug: Log the retrieved API key

        const processedImages = new Set(); // Initialize a set to keep track of processed images

        async function classifyAndModifyImages() {
            const filteredImages = Array.from(document.querySelectorAll('img.update-components-image__image'))
                .filter(img => img.clientWidth >= 500 || img.clientHeight >= 500);
            console.debug("Filtered Images:", filteredImages.length); // Debug: Log the number of filtered images

            filteredImages.forEach(img => console.debug("Image src:", img.src)); // Debug: Log each filtered image source
            for (let img of filteredImages) {
                if (processedImages.has(img.src)) {
                    console.debug(`Image already processed: ${img.src}`); // Debug: Log if an image was already processed
                    continue; // Skip this image if it has already been processed
                }
                console.debug(`Processing image: ${img.src}`); // Debug: Log the image being processed

                processedImages.add(img.src); // Add the original image URL to the set of processed images

                // Call the Google Cloud Function to classify the image
                const requestBody = {
                    data: {
                        model: "claude-3-haiku-20240229", // Example model name, adjust as necessary
                        messages: [
                            {
                                role: "user",
                                content: [
                                    { 
                                        type: "image", 
                                        source: {
                                            type: "url",
                                            media_type: "image/jpeg", // Adjust based on your image's MIME type
                                            url: img.src,
                                        }
                                    },
                                    { 
                                        type: "text", 
                                        text: "Classify this image." // Adjust your prompt as necessary
                                    }
                                ],
                            },
                        ],
                        max_tokens: 300
                    }
                };

                try {
                    console.debug("Sending image for classification", requestBody); // Debug: Log the request body being sent for classification
                    const response = await fetch('https://us-central1-linkedin-unhumbled.cloudfunctions.net/linkedin-unhumbled/classify_image', { // Replace with your Cloud Function URL
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(requestBody)
                    }).then(res => res.json());
                    console.debug("Response:", JSON.stringify(response, null, 2)); // Debug: Log the response from classification
                    if (response.choices && response.choices.length > 0) {
                        const classification = response.choices[0].message.content;

                        if (classification === "cringe_selfie") {
                            let overlay = document.createElement('img');
                            chrome.storage.sync.get('selectedImage', function (data) {
                                const selectedImageId = data.selectedImage; // Get selected image ID from storage
                                let selectedImageUrl;
                                switch (selectedImageId) {
                                    case 'pig':
                                        selectedImageUrl = chrome.runtime.getURL("assets/pig.webp");
                                        break;
                                    case 'clown':
                                        selectedImageUrl = chrome.runtime.getURL("assets/clown.webp");
                                        break;
                                    case 'puppy':
                                        selectedImageUrl = chrome.runtime.getURL("assets/puppy.webp");
                                        break;
                                    default:
                                        selectedImageUrl = ''; // Default case if no matching ID is found
                                }
                                console.debug("Overlay image selected:", selectedImageUrl); // Debug: Log the selected overlay image URL
                                overlay.src = selectedImageUrl;
                                overlay.style.position = "absolute";
                                overlay.style.width = img.offsetWidth + "px"; // Set the overlay width to match the original image
                                overlay.style.height = img.offsetHeight + "px"; // Set the overlay height to match the original image
                                overlay.style.left = "0"; // Align the overlay to the top-left corner of the parent
                                overlay.style.top = "0"; // Align the overlay to the top-left corner of the parent
                                overlay.style.objectFit = "cover";
                                chrome.storage.sync.get('overlayOpacity', function(data) {
                                    overlay.style.opacity = data.overlayOpacity / 100;
                                });
                                overlay.style.zIndex = "1000";
                                img.parentNode.style.position = "relative";
                                img.style.objectFit = "cover";
                                img.parentNode.insertBefore(overlay, img.nextSibling);
                            });
                        }
                    } else {
                        console.error("No choices available in the response:", JSON.stringify(response, null, 2)); // Debug: Log if no choices are available
                    }
                } catch (error) {
                    console.error("Error classifying image with the Cloud Function:", error); // Debug: Log any errors during classification
                }
            }
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
                console.debug(`${modifiedPostsCount} posts modified to have a light grey background due to containing keywords.`); // Debug: Log the number of modified posts
            } 
        }

        // Call both functions to modify posts and images
        await modifyLinkedInPosts();
        await classifyAndModifyImages();

        // MutationObserver setup remains unchanged
        let observer = new MutationObserver(async (mutationsList, observer) => {
            await modifyLinkedInPosts();
            await classifyAndModifyImages(); // Note: This is an async function with await here
        });
        observer.observe(document.body, { childList: true, subtree: true });
    });
})();