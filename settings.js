document.addEventListener('DOMContentLoaded', function() {
    chrome.storage.sync.get(['apiKey', 'filterWords'], function(data) {
        if(data.apiKey) {
            document.getElementById('apiKey').value = data.apiKey;
            document.getElementById('apiKey').style.display = "block"; // Ensure API Key input is always visible
        }
        if(data.filterWords) {
            document.getElementById('filterWords').value = data.filterWords;
        }
    });

    document.getElementById('settingsForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const apiKey = document.getElementById('apiKey').value;
        const filterWords = document.getElementById('filterWords').value;
        chrome.storage.sync.set({apiKey: apiKey, filterWords: filterWords}, function() {
            alert('Settings saved');
            document.getElementById('apiKey').style.display = "block"; // Keep API Key input visible after saving
        });
    });
});
