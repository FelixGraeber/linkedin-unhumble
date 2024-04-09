document.getElementById('settingsForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const apiKey = document.getElementById('apiKey').value;
    const filterWords = document.getElementById('filterWords').value; // Add this line to get the filterWords value
    chrome.storage.sync.set({apiKey: apiKey, filterWords: filterWords}, function() { // Include filterWords in the object to be saved
        console.log('Settings saved');
    });
});