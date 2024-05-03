document.addEventListener('DOMContentLoaded', function() {
    chrome.storage.sync.get(['filterWords', 'selectedImage', 'filterWordsPrefix'], function(data) {
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
        if(data.filterWordsPrefix) {
            document.querySelectorAll('.prefix-button').forEach(button => {
                if(button.getAttribute('data-value') === data.filterWordsPrefix) {
                    button.classList.add('selected');
                } else {
                    button.classList.remove('selected');
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

    document.querySelectorAll('.prefix-button').forEach(button => {
        button.addEventListener('click', function() {
            document.querySelectorAll('.prefix-button').forEach(innerButton => {
                innerButton.classList.remove('selected');
            });
            button.classList.add('selected');
            chrome.storage.sync.set({'filterWordsPrefix': button.getAttribute('data-value')}, function() {
                console.log('Filter Words Prefix saved');
            });
        });
    });

    document.getElementById('settingsForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const filterWords = document.getElementById('filterWords').value;
        const selectedImage = document.querySelector('.image-preview div.highlight').id;
        const filterWordsPrefix = document.querySelector('.prefix-button.selected').getAttribute('data-value');
        chrome.storage.sync.set({filterWords: filterWords, selectedImage: selectedImage, filterWordsPrefix: filterWordsPrefix}, function() {
            alert('Settings saved');
        });
    });
});
