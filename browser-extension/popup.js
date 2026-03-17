// popup.js
chrome.storage.local.get(['wsPort', 'wsConnected'], (data) => {
  document.getElementById('portInput').value = data.wsPort || 3701;
  updateStatus(data.wsConnected);
});

document.getElementById('connectBtn').addEventListener('click', () => {
  const port = parseInt(document.getElementById('portInput').value) || 3701;
  chrome.storage.local.set({ wsPort: port });
  chrome.runtime.sendMessage({ action: 'connect', port });
});

document.getElementById('disconnectBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'disconnect' });
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.wsConnected) updateStatus(changes.wsConnected.newValue);
});

function updateStatus(connected) {
  const dot = document.getElementById('statusDot');
  const text = document.getElementById('statusText');
  dot.className = 'dot ' + (connected ? 'connected' : 'disconnected');
  text.textContent = connected ? 'Connected to VS Code' : 'Disconnected';
}
