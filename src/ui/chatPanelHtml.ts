import * as vscode from 'vscode';
import { CodeBlock } from '../types';

export function generateControlPanelHtml(
  webview: vscode.Webview,
  nonce: string
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>CodeBreeze</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 8px;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    h3 {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 6px;
      padding-bottom: 4px;
      border-bottom: 1px solid var(--vscode-widget-border);
    }
    .toolbar {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 0 8px;
      border-bottom: 1px solid var(--vscode-widget-border);
      margin-bottom: 8px;
    }
    .toolbar-title {
      font-weight: bold;
      font-size: 13px;
      flex: 1;
    }
    .main {
      display: flex;
      gap: 8px;
      flex: 1;
      overflow: hidden;
    }
    .panel {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border: 1px solid var(--vscode-widget-border);
      border-radius: 4px;
      padding: 8px;
    }
    .panel-content {
      flex: 1;
      overflow-y: auto;
      margin-top: 6px;
    }
    button {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 4px 8px;
      border-radius: 2px;
      cursor: pointer;
      font-size: 11px;
      white-space: nowrap;
    }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button.secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
    button.icon { padding: 4px 6px; }
    .send-buttons {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .send-btn {
      text-align: left;
      width: 100%;
    }
    .code-block-item {
      border: 1px solid var(--vscode-widget-border);
      border-radius: 4px;
      margin-bottom: 8px;
      overflow: hidden;
    }
    .code-block-header {
      display: flex;
      align-items: center;
      padding: 4px 8px;
      background: var(--vscode-editor-lineHighlightBackground);
      font-size: 11px;
      gap: 6px;
    }
    .code-block-filename {
      flex: 1;
      font-weight: bold;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .code-block-preview {
      padding: 6px 8px;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 11px;
      white-space: pre;
      overflow-x: auto;
      max-height: 80px;
      color: var(--vscode-editor-foreground);
      background: var(--vscode-editor-background);
    }
    .no-blocks {
      color: var(--vscode-descriptionForeground);
      font-style: italic;
      font-size: 12px;
      text-align: center;
      padding: 16px;
    }
    .watch-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 6px;
      font-size: 11px;
    }
    .status-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: var(--vscode-charts-red);
      display: inline-block;
    }
    .status-dot.active { background: var(--vscode-charts-green); }
    .apply-all-row {
      display: flex;
      gap: 6px;
      margin-top: 6px;
    }
    .loading { color: var(--vscode-descriptionForeground); font-style: italic; }
  </style>
</head>
<body>
  <div class="toolbar">
    <span class="toolbar-title">🤖 CodeBreeze</span>
    <button class="secondary icon" id="btnRefresh" title="Refresh clipboard">🔄</button>
    <button class="secondary icon" id="btnOpenChat" title="Open AI Chat">💬</button>
  </div>

  <div class="main">
    <!-- LEFT: Send Context -->
    <div class="panel" style="max-width: 160px; min-width: 130px;">
      <h3>📤 Send</h3>
      <div class="panel-content">
        <div class="send-buttons">
          <button class="send-btn secondary" data-type="file">📄 Current File</button>
          <button class="send-btn secondary" data-type="selection">📌 Selection</button>
          <button class="send-btn secondary" data-type="errors">⚡ Errors</button>
          <button class="send-btn secondary" data-type="gitDiff">🔀 Git Diff</button>
          <button class="send-btn secondary" data-type="gitLog">📜 Git Log</button>
          <button class="send-btn secondary" data-type="buildLog">📋 Build Log</button>
          <hr style="margin: 4px 0; border-color: var(--vscode-widget-border);">
          <button class="send-btn" id="btnBuild">🔨 Run Build</button>
          <button class="send-btn" id="btnTest">🧪 Run Test</button>
          <hr style="margin: 4px 0; border-color: var(--vscode-widget-border);">
          <button id="btnSendAll">Send All & Open Chat</button>
        </div>
      </div>
    </div>

    <!-- RIGHT: Receive & Apply -->
    <div class="panel">
      <h3>📥 Receive & Apply</h3>
      <div class="panel-content" id="blocksContainer">
        <div class="no-blocks" id="noBlocks">
          No code blocks in clipboard.<br>
          Click 🔄 to refresh.
        </div>
      </div>
      <div class="apply-all-row">
        <button id="btnApplyAll" style="display:none;">✅ Apply All</button>
        <div class="watch-row">
          <span class="status-dot" id="watchDot"></span>
          <button class="secondary" id="btnToggleWatch">Auto-watch: OFF</button>
        </div>
      </div>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let blocks = [];
    let watching = false;

    // Toolbar buttons
    document.getElementById('btnRefresh').addEventListener('click', () => {
      vscode.postMessage({ command: 'refreshClipboard' });
    });
    document.getElementById('btnOpenChat').addEventListener('click', () => {
      vscode.postMessage({ command: 'openChat' });
    });
    document.getElementById('btnApplyAll').addEventListener('click', () => {
      vscode.postMessage({ command: 'applyAll' });
    });
    document.getElementById('btnBuild').addEventListener('click', () => {
      vscode.postMessage({ command: 'runBuild' });
    });
    document.getElementById('btnTest').addEventListener('click', () => {
      vscode.postMessage({ command: 'runTest' });
    });
    document.getElementById('btnSendAll').addEventListener('click', () => {
      const types = Array.from(document.querySelectorAll('.send-btn[data-type]'))
        .map(btn => btn.dataset.type);
      vscode.postMessage({ command: 'sendContext', types });
    });
    document.getElementById('btnToggleWatch').addEventListener('click', () => {
      watching = !watching;
      updateWatchUI();
      vscode.postMessage({ command: 'toggleWatch', enabled: watching });
    });

    // Send context buttons
    document.querySelectorAll('.send-btn[data-type]').forEach(btn => {
      btn.addEventListener('click', () => {
        vscode.postMessage({ command: 'sendContext', types: [btn.dataset.type] });
      });
    });

    function updateWatchUI() {
      const dot = document.getElementById('watchDot');
      const btn = document.getElementById('btnToggleWatch');
      if (watching) {
        dot.classList.add('active');
        btn.textContent = 'Auto-watch: ON';
      } else {
        dot.classList.remove('active');
        btn.textContent = 'Auto-watch: OFF';
      }
    }

    function renderBlocks(newBlocks) {
      blocks = newBlocks;
      const container = document.getElementById('blocksContainer');
      const noBlocks = document.getElementById('noBlocks');
      const applyAllBtn = document.getElementById('btnApplyAll');

      if (!blocks || blocks.length === 0) {
        noBlocks.style.display = 'block';
        applyAllBtn.style.display = 'none';
        // Clear old block items
        container.querySelectorAll('.code-block-item').forEach(el => el.remove());
        return;
      }

      noBlocks.style.display = 'none';
      applyAllBtn.style.display = blocks.length > 1 ? 'inline-block' : 'none';

      // Remove old items
      container.querySelectorAll('.code-block-item').forEach(el => el.remove());

      blocks.forEach((block, idx) => {
        const item = document.createElement('div');
        item.className = 'code-block-item';

        const header = document.createElement('div');
        header.className = 'code-block-header';

        const filename = document.createElement('span');
        filename.className = 'code-block-filename';
        filename.textContent = block.filePath || \`Block \${idx+1} (\${block.language || 'unknown'})\`;

        const applyBtn = document.createElement('button');
        applyBtn.className = 'icon';
        applyBtn.textContent = '✅ Apply';
        applyBtn.addEventListener('click', () => {
          vscode.postMessage({ command: 'applyBlock', index: idx });
        });

        header.appendChild(filename);
        header.appendChild(applyBtn);

        const preview = document.createElement('div');
        preview.className = 'code-block-preview';
        const previewLines = block.content.split('\\n').slice(0, 5);
        preview.textContent = previewLines.join('\\n') + (block.content.split('\\n').length > 5 ? '\\n...' : '');

        item.appendChild(header);
        item.appendChild(preview);
        container.insertBefore(item, noBlocks);
      });
    }

    // Handle messages from extension
    window.addEventListener('message', event => {
      const msg = event.data;
      switch (msg.command) {
        case 'updateBlocks':
          renderBlocks(msg.blocks);
          break;
        case 'setWatching':
          watching = msg.enabled;
          updateWatchUI();
          break;
        case 'showLoading':
          document.getElementById('noBlocks').textContent = msg.text || 'Loading...';
          document.getElementById('noBlocks').style.display = 'block';
          break;
      }
    });

    // Initial refresh
    vscode.postMessage({ command: 'refreshClipboard' });
  </script>
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
