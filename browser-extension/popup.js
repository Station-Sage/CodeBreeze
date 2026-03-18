// popup.js
chrome.storage.local.get(['wsPort', 'wsConnected'], (data) => {
  document.getElementById('portInput').value = data.wsPort || 3701;
  updateStatus(data.wsConnected);

  // Auto-reconnect if disconnected when popup opens
  if (!data.wsConnected) {
    const port = data.wsPort || 3701;
    chrome.runtime.sendMessage({ action: 'connect', port });
  }
});

document.getElementById('connectBtn').addEventListener('click', () => {
  const port = parseInt(document.getElementById('portInput').value) || 3701;
  chrome.storage.local.set({ wsPort: port });
  chrome.runtime.sendMessage({ action: 'connect', port });
});

document.getElementById('disconnectBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'disconnect' });
});

document.getElementById('testSelectorsBtn').addEventListener('click', () => {
  const resultEl = document.getElementById('testResult');
  resultEl.className = 'test-result show';
  resultEl.textContent = 'Testing selectors...';
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'testSelectors' });
    } else {
      resultEl.textContent = 'No active tab found';
    }
  });
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'selectorTestResult') {
    const r = msg.results;
    const resultEl = document.getElementById('testResult');
    resultEl.className = 'test-result show';
    const ok = (v) => `<span class="test-ok">OK</span> (${v})`;
    const fail = () => '<span class="test-fail">FAIL</span>';
    resultEl.innerHTML = [
      `<b>Selector Test</b> (v${r.version})`,
      `Response containers: ${r.responseContainers > 0 ? ok(r.responseContainers) : fail()}`,
      `Input field: ${r.inputField ? ok('found') : fail()}`,
      `Send button: ${r.sendButton ? ok('found') : fail()}`,
      `Code blocks: ${r.codeBlocks > 0 ? ok(r.codeBlocks) : 'none detected'}`,
    ].join('<br>');
  }
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
