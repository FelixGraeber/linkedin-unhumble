document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('settingsButton').addEventListener('click', function() {
        console.log('Opening settings page');
        window.open(chrome.runtime.getURL('./src/settings/settings.html'));
    });
});