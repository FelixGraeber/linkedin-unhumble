document.addEventListener('DOMContentLoaded', function() {
    chrome.storage.sync.get(['apiKey', 'filterWords', 'selectedImage'], function(data) {
        if(data.apiKey) {
            document.getElementById('apiKey').value = data.apiKey;
            document.getElementById('apiKey').style.display = "block"; // Ensure API Key input is always visible
        }
        if(data.filterWords) {
            document.getElementById('filterWords').value = data.filterWords;
        }
        if(data.selectedImage) {
            document.querySelectorAll('.image-preview div').forEach(div => {
                if(div.id === data.selectedImage) {
                    div.classList.add('highlight');
                } else {
                    div.classList.remove('highlight');
                }
            });
        }
    });

    document.querySelectorAll('.image-preview div').forEach(div => {
        div.addEventListener('click', function() {
            document.querySelectorAll('.image-preview div').forEach(innerDiv => {
                innerDiv.classList.remove('highlight');
            });
            div.classList.add('highlight');
        });
    });

    document.getElementById('settingsForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const apiKey = document.getElementById('apiKey').value;
        const filterWords = document.getElementById('filterWords').value;
        const selectedImage = document.querySelector('.image-preview div.highlight').id;
        chrome.storage.sync.set({apiKey: apiKey, filterWords: filterWords, selectedImage: selectedImage}, function() {
            alert('Settings saved');
            document.getElementById('apiKey').style.display = "block"; // Keep API Key input visible after saving
        });
    });

    // Added functionality from settings.html
    function toggleApiKeyVisibility() {
        var apiKeyInput = document.getElementById('apiKey');
        var toggleText = document.querySelector('.toggle-api-key');
        if (apiKeyInput.type === "password") {
            apiKeyInput.type = "text";
            toggleText.textContent = "Hide";
        } else {
            apiKeyInput.type = "password";
            toggleText.textContent = "Show";
        }
    }
    document.querySelector('.toggle-api-key').addEventListener('click', toggleApiKeyVisibility);
});
