// background.js — WebSocket 연결 관리 + 메시지 라우팅

let ws = null;
let reconnectTimer = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 1000; // 1초

// ── WebSocket Connection ──

function connect(port) {
  if (ws && ws.readyState === WebSocket.OPEN) return;

  const url = `ws://127.0.0.1:${port}`;
  ws = new WebSocket(url);

  ws.onopen = () => {
    console.log('[CodeBreeze] Connected to VS Code bridge');
    reconnectAttempts = 0;
    chrome.storage.local.set({ wsConnected: true });
    ws.send(JSON.stringify({ type: 'getStatus' }));
  };

  ws.onmessage = (event) => {
    let msg;
    try { msg = JSON.parse(event.data); } catch { return; }

    switch (msg.type) {
      case 'send_to_ai':
        // VS Code → browser → AI챗 입력창
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            chrome.tabs.sendMessage(tabs[0].id, {
              action: 'sendToAIChat',
              payload: msg.payload,
              autoSend: msg.autoSend ?? false,
            });
          }
        });
        break;

      case 'pong':
      case 'status':
      case 'applyResult':
      case 'clipboardReady':
        // popup이나 content script에 필요시 전달
        break;
    }
  };

  ws.onclose = () => {
    ws = null;
    chrome.storage.local.set({ wsConnected: false });
    scheduleReconnect(port);
  };

  ws.onerror = () => {
    // onclose가 이후 호출됨
  };
}

function disconnect() {
  clearTimeout(reconnectTimer);
  reconnectTimer = null;
  reconnectAttempts = MAX_RECONNECT_ATTEMPTS; // 재연결 방지
  if (ws) {
    ws.close();
    ws = null;
  }
  chrome.storage.local.set({ wsConnected: false });
}

function scheduleReconnect(port) {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;
  // 지수 백오프: 1s, 2s, 4s, 8s, ... max 30s
  const delay = Math.min(BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts), 30000);
  reconnectAttempts++;
  reconnectTimer = setTimeout(() => connect(port), delay);
}

function sendToVSCode(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

// ── Message handlers from content script & popup ──

chrome.runtime.onMessage.addListener((msg, _sender, _sendResponse) => {
  switch (msg.action) {
    case 'codeBlocksDetected':
      sendToVSCode({
        type: 'codeBlocks',
        blocks: msg.blocks,
        source: msg.source,
      });
      break;

    case 'aiResponse':
      sendToVSCode({
        type: 'ai_response',
        payload: msg.payload,
        source: msg.source,
      });
      break;

    case 'connect':
      reconnectAttempts = 0;
      connect(msg.port || 3701);
      break;

    case 'disconnect':
      disconnect();
      break;
  }
});

// ── Auto-connect on startup ──
chrome.storage.local.get(['wsPort'], (data) => {
  const port = data.wsPort || 3701;
  connect(port);
});

// ── Keep-alive ping (Manifest V3 service worker stays alive) ──
setInterval(() => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'ping' }));
  }
}, 25000);
