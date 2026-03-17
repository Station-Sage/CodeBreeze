// src/ui/chatPanelHtml.ts
// Main HTML assembly for the CodeBreeze control panel webview.

import * as vscode from 'vscode';
import { getControlPanelStyles } from './chatPanelStyles';
import { getControlPanelScript } from './chatPanelScript';

export function generateControlPanelHtml(
  _webview: vscode.Webview,
  nonce: string
): string {
  const styles = getControlPanelStyles();
  const script = getControlPanelScript();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>CodeBreeze</title>
  <style>${styles}</style>
</head>
<body>

  <!-- Tab bar -->
  <div class="tab-bar">
    <button class="tab active" data-tab="send"
      title="컨텍스트를 AI Chat에 전송합니다 (Ctrl+Shift+S: Smart Context)">📤 Send</button>
    <button class="tab" data-tab="receive"
      title="AI 응답 코드를 클립보드에서 받아서 적용합니다 (Ctrl+Shift+A: Apply All)">📥 Receive</button>
    <button class="tab" data-tab="history"
      title="코드 적용 기록을 확인하고 되돌립니다 (Ctrl+Shift+U: Undo)">📋 History</button>
    <button class="tab" data-tab="bridge"
      title="브라우저 확장과의 실시간 브릿지 상태 및 대화 히스토리">🌐 Bridge</button>
  </div>

  <!-- SEND Tab -->
  <div class="tab-content" id="tab-send">
    <button class="primary-btn" id="btnSmartContext" title="Smart Context (Ctrl+Shift+S)">
      Smart Context
    </button>
    <button class="chat-btn secondary" id="btnOpenChat" title="Open AI Chat (Ctrl+Shift+H)">
      Open AI Chat
    </button>

    <details>
      <summary title="Individual context items">Advanced options</summary>
      <div class="advanced-buttons">
        <button class="send-btn secondary" data-type="file">Current File</button>
        <button class="send-btn secondary" data-type="selection">Selection</button>
        <button class="send-btn secondary" data-type="errors">Errors &amp; Warnings</button>
        <button class="send-btn secondary" data-type="gitDiff">Git Diff</button>
        <button class="send-btn secondary" data-type="gitLog">Git Log</button>
        <button class="send-btn secondary" data-type="buildLog">Build Log</button>
        <hr>
        <button class="send-btn" id="btnBuild">Run Build &amp; Copy</button>
        <button class="send-btn" id="btnTest">Run Test &amp; Copy</button>
      </div>
    </details>
  </div>

  <!-- RECEIVE Tab -->
  <div class="tab-content hidden" id="tab-receive">
    <div class="watch-row">
      <span class="status-dot" id="watchDot"></span>
      <button class="secondary" id="btnToggleWatch">Auto-watch: OFF</button>
      <button class="secondary icon" id="btnRefresh" title="Refresh clipboard">&#x1F504;</button>
    </div>

    <div id="blocksContainer">
      <div class="no-blocks" id="noBlocks">
        No code blocks in clipboard.<br>
        Refresh or enable Auto-watch.
      </div>
    </div>

    <div id="applyAllRow" style="display:none; padding-top:4px; flex-shrink:0;">
      <button id="btnApplyAll" style="width:100%;" title="Apply all blocks (Ctrl+Shift+A)">
        Apply All
      </button>
    </div>
  </div>

  <!-- HISTORY Tab -->
  <div class="tab-content hidden" id="tab-history">
    <div id="historyContainer">
      <div class="no-blocks">No history yet.</div>
    </div>
  </div>

  <!-- ── BRIDGE Tab ── -->
  <div class="tab-content hidden" id="tab-bridge">
    <div class="watch-row">
      <span class="status-dot" id="bridgeDot"></span>
      <span id="bridgeStatus" style="font-size:12px;">Bridge: Not started</span>
      <button class="secondary icon" id="btnStartBridge" title="Start bridge">&#x25B6;</button>
      <button class="secondary icon" id="btnStopBridge" title="Stop bridge">&#x23F9;</button>
    </div>

    <div id="bridgeChatHistory" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:4px;">
      <div class="no-blocks" id="noBridgeMessages">
        Waiting for browser extension...<br>
        Press play to start the bridge.
      </div>
    </div>

    <div style="display:flex; gap:4px; flex-shrink:0; padding-top:4px;">
      <textarea id="bridgeInput" rows="2"
        placeholder="Message to send to AI..."
        style="flex:1; resize:none; font-family:var(--vscode-font-family); font-size:12px;
              background:var(--vscode-input-background); color:var(--vscode-input-foreground);
              border:1px solid var(--vscode-input-border); border-radius:3px; padding:6px;"></textarea>
      <button id="btnBridgeSend" style="align-self:flex-end;" title="Send via browser extension">Send</button>
    </div>

    <div style="display:flex; gap:4px; flex-shrink:0; padding-top:2px;">
      <button class="secondary" id="btnBridgeSendContext" style="flex:1; font-size:11px;"
        title="Send Smart Context to AI via bridge">Send Context</button>
      <button class="secondary" id="btnAgentLoop" style="flex:1; font-size:11px;"
        title="Auto loop: apply -> build -> error -> fix (max iterations)">Agent Loop</button>
    </div>
  </div>

  <script nonce="${nonce}">${script}</script>
</body>
</html>`;
}

export function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
