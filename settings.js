document.getElementById('settingsForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const apiKey = document.getElementById('apiKey').value;
    chrome.storage.sync.set({apiKey: apiKey}, function() {
        console.log('API Key saved');
    });
});