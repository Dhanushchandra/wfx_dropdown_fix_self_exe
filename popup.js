const btn = document.getElementById("toggleBtn");

chrome.storage.local.get("enabled", (data) => {
  updateButton(data.enabled);
});

btn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "toggle" }, (response) => {
    updateButton(response.enabled);
  });
});

function updateButton(isOn) {
  if (isOn) {
    btn.textContent = "Turn OFF";
    btn.className = "on";
  } else {
    btn.textContent = "Turn ON";
    btn.className = "off";
  }
}