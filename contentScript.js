console.log("LinkedIn Feed Filter content script injected. Starting to modify posts...");

(async function() {
    chrome.storage.sync.get('apiKey', async function(data) {
        const apiKey = data.apiKey; // Get API key from storage

        async function classifyAndModifyActiveImage() {
            const activeImageElement = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
            if (activeImageElement && activeImageElement.alt === "Bildvorschau") {
                
                console.log(`Processing active image: ${activeImageElement.src}`);
                const imageUrl = activeImageElement.src;
                
                // Resize image for GPT processing
                const resizedImageUrl = imageUrl + '?resize=100x100';

                const requestBody = {
                    model: "gpt-4-vision-preview",
                    messages: [
                        {
                            role: "user",
                            content: [
                                { type: "text", text: "ONLY CLASSIFY THE IMAGE IN EITHER SELFIE OR NON-SELFIE. RESPOND ONLY WITH 'selfie' or 'non_selfie':" },
                                { type: "image_url", image_url: { "url": resizedImageUrl } },
                                                       ],
                        },
                    ],
                    max_tokens: 300
                };

                try {
                    console.log("Sending active image for classification with OpenAI API", requestBody);
                    const response = await fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        body: JSON.stringify(requestBody)
                    }).then(res => res.json());
                    console.log("Response from OpenAI API:", JSON.stringify(response, null, 2));
                    const classification = response.choices[0].message.content;

                    if (classification === "selfie") {
                        activeImageElement.src = "https://media.istockphoto.com/id/546462560/vector/happy-pig.jpg?s=612x612&w=0&k=20&c=zS746w4A9BcFHZPJiW2V0AYfl4UMOlOnoZGXstQ6YL8=";
                    }
                } catch (error) {
                    console.error("Error classifying active image:", error);
                }
            } else {
                console.log("No active image found or the active element is not an image.");
            }
        }

        // Existing function to modify LinkedIn posts based on text content
        function modifyLinkedInPosts() {
            console.log("Scanning LinkedIn feed for new posts to modify...");
            
            let modifiedPostsCount = 0; // Keep track of how many posts were modified
            const textViewElements = document.querySelectorAll('span.text-view-model'); // Select all spans with class 'text-view-model'
            console.log(`SELECTED: ${textViewElements} `)
            textViewElements.forEach(textViewElement => {
                const postText = textViewElement.innerText.toLowerCase();
                // Check if post contains any of the keywords
                if (postText.includes("humble") || postText.includes("humbled") || postText.includes("proud") || postText.includes("blessed") || postText.includes("grateful") || postText.includes("excited")) {
                    textViewElement.style.color = "lightgrey";
                    modifiedPostsCount++;
                    console.log("Found something!");
                }
            });

            if (modifiedPostsCount > 0) {
                console.log(`${modifiedPostsCount} posts modified to have a light grey background due to containing keywords.`);
            } else {
                console.log("No new posts matched the criteria for modification.");
            }
        }
        
        // Call both functions to modify posts and images
        modifyLinkedInPosts();
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for 2 seconds
        await classifyAndModifyActiveImage();

        // MutationObserver setup remains unchanged
        let observer = new MutationObserver((mutationsList, observer) => {
            console.log("Detected changes in the page, checking for new posts and images to modify...");
            modifyLinkedInPosts();
            classifyAndModifyActiveImage(); // Note: This is an async function without await here
        });
        observer.observe(document.body, {childList: true, subtree: true});
        console.log("MutationObserver set up to monitor page for changes.");
    });
})();
