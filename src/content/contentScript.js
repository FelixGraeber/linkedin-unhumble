console.log("LinkedIn Feed Filter content script injected. Starting to modify posts...");

(async function () {
    chrome.storage.sync.get('apiKey', async function (data) {
        const apiKey = data.apiKey; // Get API key from storage

        const processedImages = new Set(); // Initialize a set to keep track of processed images

        async function classifyAndModifyImages() {
            const imageElements = document.querySelectorAll('img.update-components-image__image');
            for (let img of imageElements) {
                if (processedImages.has(img.src)) {
                    console.log(`Image already processed: ${img.src}`);
                    continue; // Skip this image if it has already been processed
                }
                console.log(`Processing image: ${img.src}`);
                const imageUrl = img.src;
                processedImages.add(imageUrl); // Add the image URL to the set of processed images

                const requestBody = {
                    model: "gpt-4-vision-preview",
                    messages: [
                        {
                            role: "user",
                            content: [
                                { type: "text", text: "ONLY CLASSIFY THE IMAGE IN EITHER SINGLE_PERSON OR NOT. RESPOND ONLY WITH 'single_person' IF ONLY 1 PERSON IS VISIBLE ON THE PHOTO OR ELSE 'other':" },
                                { type: "image_url", image_url: { "url": imageUrl, "detail": "low" } },
                            ],
                        },
                    ],
                    max_tokens: 300
                };

                try {
                    console.log("Sending image for classification with OpenAI API", requestBody);
                    const response = await fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        body: JSON.stringify(requestBody)
                    }).then(res => res.json());
                    console.log("Response from OpenAI API:", JSON.stringify(response, null, 2));
                    if (response.choices && response.choices.length > 0) {
                        const classification = response.choices[0].message.content;

                        if (classification === "single_person") {
                            let overlay = document.createElement('img');
                            chrome.storage.sync.get('selectedImage', function (data) {
                                const selectedImageId = data.selectedImage; // Get selected image ID from storage
                                const selectedImageUrl = {
                                    pig: "./assets/pig.webp",
                                    clown: "./assets/clown.webp",
                                    puppy: "./assets/puppy.webp"
                                }[selectedImageId]; // Map selected image ID to its URL
                                overlay.src = selectedImageUrl;
                                overlay.style.position = "absolute";
                            });
                            overlay.style.width = img.offsetWidth + "px"; // Set the overlay width to match the original image
                            overlay.style.height = img.offsetHeight + "px"; // Set the overlay height to match the original image
                            overlay.style.left = "0"; // Align the overlay to the top-left corner of the parent
                            overlay.style.top = "0"; // Align the overlay to the top-left corner of the parent
                            overlay.style.objectFit = "cover";
                            overlay.style.opacity = "0.69";
                            overlay.style.zIndex = "1000";
                            img.parentNode.style.position = "relative";
                            img.style.objectFit = "cover";
                            img.parentNode.insertBefore(overlay, img.nextSibling);
                        }
                    } else {
                        console.error("No choices available in the response:", JSON.stringify(response, null, 2));
                    }
                } catch (error) {
                    console.error("Error classifying image:", error);
                }
            }
        }

        // Existing function to modify LinkedIn posts based on text content
        function modifyLinkedInPosts() {
            console.log("Scanning LinkedIn feed for new posts to modify...");

            let modifiedPostsCount = 0; // Keep track of how many posts were modified
            const textViewElements = document.querySelectorAll('span.text-view-model'); // Select all spans with class 'text-view-model'
            textViewElements.forEach(textViewElement => {
                const postText = textViewElement.innerText.toLowerCase();
                // Check if post contains any of the keywords
                const filterWords = ["humble", "proud", "blessed"]; // Assuming these are the filterWords from settings.html
                if (filterWords.some(word => postText.includes(word))) {
                    textViewElement.style.color = "#ebe7e7";
                    textViewElement.querySelectorAll('a').forEach(link => {
                        link.style.color = "lightgrey";
                    });
                    modifiedPostsCount++;
                    console.log("Found something!");
                }
            });

            if (modifiedPostsCount > 0) {
                console.log(`${modifiedPostsCount} posts modified to have a light grey background due to containing keywords.`);
            } 
        }

        // Call both functions to modify posts and images
        modifyLinkedInPosts();
        await classifyAndModifyImages();
        modifyLinkedInPosts();

        // MutationObserver setup remains unchanged
        let observer = new MutationObserver((mutationsList, observer) => {
            modifyLinkedInPosts();
            classifyAndModifyImages(); // Note: This is an async function without await here
            modifyLinkedInPosts();
        });
        observer.observe(document.body, { childList: true, subtree: true });
    });
})();