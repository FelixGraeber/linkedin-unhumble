document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('settingsButton').addEventListener('click', function() {
        console.log('Opening settings page');
        window.open(chrome.runtime.getURL('settings.html'));
    });

    document.getElementById('apiKeyButton').addEventListener('click', function() {
        console.log('Opening API key settings');
        window.open(chrome.runtime.getURL('settings.html'));
    });
});