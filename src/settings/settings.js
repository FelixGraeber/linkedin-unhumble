document.addEventListener('DOMContentLoaded', function() {
    chrome.storage.sync.get(['apiKey', 'filterWords', 'selectedImage', 'overlayOpacity'], function(data) {
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
        if(data.overlayOpacity !== undefined) {
            document.getElementById('overlayOpacity').value = data.overlayOpacity;
            document.getElementById('opacityValue').textContent = data.overlayOpacity + '%'; // Update the display value when fetched
        } else {
            document.getElementById('overlayOpacity').value = 100; // Default value if not set
            document.getElementById('opacityValue').textContent = '100%'; // Default display value
        }
    });

    document.getElementById('overlayOpacity').addEventListener('input', function() {
        const value = (this.value - this.min) / (this.max - this.min) * 100;
        this.style.setProperty('--thumb-percentage', `${value}%`);
        document.getElementById('opacityValue').textContent = this.value + '%'; // Update the display value on slider move
        localStorage.setItem('overlayOpacity', this.value); // Save the slider value to local storage when adjusted
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
        const overlayOpacity = document.getElementById('overlayOpacity').value;
        chrome.storage.sync.set({apiKey: apiKey, filterWords: filterWords, selectedImage: selectedImage, overlayOpacity: overlayOpacity}, function() {
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
    var toggleButton = document.querySelector('.toggle-api-key');
    toggleButton.addEventListener('click', toggleApiKeyVisibility);

    // Retrieve and set the slider value on page load
    const savedValue = localStorage.getItem('overlayOpacity');
    if (savedValue) {
        document.getElementById('overlayOpacity').value = savedValue;
        document.getElementById('opacityValue').textContent = savedValue + '%';
    }
});
