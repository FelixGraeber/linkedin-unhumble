document.addEventListener('DOMContentLoaded', function() {
    chrome.storage.sync.get(['filterWords', 'selectedImage', 'overlayOpacity', 'filterWordsPrefix'], function(data) {
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
        const overlayOpacity = document.getElementById('overlayOpacity').value;
        const filterWordsPrefix = document.querySelector('.prefix-button.selected').getAttribute('data-value');
        chrome.storage.sync.set({filterWords: filterWords, selectedImage: selectedImage, overlayOpacity: overlayOpacity, filterWordsPrefix: filterWordsPrefix}, function() {
            alert('Settings saved');
        });
    });

    // Retrieve and set the slider value on page load
    const savedValue = localStorage.getItem('overlayOpacity');
    if (savedValue) {
        document.getElementById('overlayOpacity').value = savedValue;
        document.getElementById('opacityValue').textContent = savedValue + '%';
    }
});
