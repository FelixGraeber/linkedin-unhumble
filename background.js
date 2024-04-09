chrome.runtime.onInstalled.addListener(function(details) {
    if (details.reason == "install") {
        chrome.tabs.create({url: "settings.html"});
    }
});

chrome.webNavigation.onHistoryStateUpdated.addListener(details => {
    if (details.url.includes('linkedin.com')) {
      chrome.scripting.executeScript({
        target: { tabId: details.tabId },
        files: ['contentScript.js']
      });
    }
  }, {url: [{urlMatches : 'https://www.linkedin.com/*'}]});
