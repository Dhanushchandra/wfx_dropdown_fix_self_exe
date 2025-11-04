chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ enabled: false });
  });
  
  // Toggle state when popup requests it
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "toggle") {
      chrome.storage.local.get("enabled", (data) => {
        const newState = !data.enabled;
        chrome.storage.local.set({ enabled: newState });
        sendResponse({ enabled: newState });
      });
      return true; // keep the message channel open for async response
    }
  });