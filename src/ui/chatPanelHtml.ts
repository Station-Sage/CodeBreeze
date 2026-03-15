import * as vscode from 'vscode';

export function generateControlPanelHtml(
  _webview: vscode.Webview,
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
      gap: 6px;
    }
    /* ── Tab bar ── */
    .tab-bar {
      display: flex;
      gap: 2px;
      border-bottom: 1px solid var(--vscode-widget-border);
      padding-bottom: 0;
      flex-shrink: 0;
    }
    .tab {
      background: transparent;
      color: var(--vscode-descriptionForeground);
      border: none;
      border-bottom: 2px solid transparent;
      padding: 5px 10px;
      cursor: pointer;
      font-size: 11px;
      font-family: var(--vscode-font-family);
      white-space: nowrap;
      border-radius: 0;
      margin-bottom: -1px;
    }
    .tab:hover { color: var(--vscode-foreground); background: var(--vscode-list-hoverBackground); }
    .tab.active {
      color: var(--vscode-foreground);
      border-bottom-color: var(--vscode-focusBorder);
      font-weight: 600;
    }
    /* ── Tab content ── */
    .tab-content {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .tab-content.hidden { display: none; }
    /* ── Buttons ── */
    button {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 5px 10px;
      border-radius: 2px;
      cursor: pointer;
      font-size: 12px;
      font-family: var(--vscode-font-family);
      white-space: nowrap;
    }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button.secondary {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
    button.icon { padding: 4px 6px; font-size: 12px; }
    /* ── Send tab ── */
    .primary-btn {
      width: 100%;
      padding: 8px 12px;
      font-size: 13px;
      font-weight: 600;
      text-align: left;
    }
    .chat-btn {
      width: 100%;
      padding: 6px 12px;
      font-size: 12px;
      text-align: left;
    }
    details { border: 1px solid var(--vscode-widget-border); border-radius: 3px; }
    details summary {
      padding: 5px 8px;
      cursor: pointer;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      user-select: none;
      list-style: none;
    }
    details summary::-webkit-details-marker { display: none; }
    details summary::before { content: '▶ '; font-size: 9px; }
    details[open] summary::before { content: '▼ '; font-size: 9px; }
    details summary:hover { color: var(--vscode-foreground); background: var(--vscode-list-hoverBackground); }
    .advanced-buttons {
      display: flex;
      flex-direction: column;
      gap: 3px;
      padding: 6px;
    }
    .send-btn {
      text-align: left;
      width: 100%;
      font-size: 11px;
      padding: 4px 8px;
    }
    hr { border: none; border-top: 1px solid var(--vscode-widget-border); margin: 2px 0; }
    /* ── Receive tab ── */
    .watch-row {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 0;
      flex-shrink: 0;
    }
    .status-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: var(--vscode-charts-red);
      display: inline-block;
      flex-shrink: 0;
    }
    .status-dot.active { background: var(--vscode-charts-green); }
    .code-block-item {
      border: 1px solid var(--vscode-widget-border);
      border-radius: 4px;
      overflow: hidden;
      flex-shrink: 0;
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
      padding: 24px 8px;
      line-height: 1.6;
    }
    /* ── History tab ── */
    .history-item {
      border: 1px solid var(--vscode-widget-border);
      border-radius: 3px;
      padding: 6px 8px;
      flex-shrink: 0;
    }
    .history-item-row {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
    }
    .history-item-label {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--vscode-foreground);
    }
    .history-time {
      color: var(--vscode-descriptionForeground);
      font-size: 10px;
    }
  </style>
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
  </div>

  <!-- ── SEND Tab ── -->
  <div class="tab-content" id="tab-send">
    <button class="primary-btn" id="btnSmartContext"
      title="현재 파일 + 에러 + Git Diff를 자동 조합하여 클립보드에 복사합니다. 이후 AI Chat에서 붙여넣기 하세요. (Ctrl+Shift+S)">
      ⚡ Smart Context
    </button>
    <button class="chat-btn secondary" id="btnOpenChat"
      title="설정된 AI Chat URL을 Simple Browser로 엽니다. 복사한 컨텍스트를 붙여넣으세요. (Ctrl+Shift+H)">
      💬 Open AI Chat
    </button>

    <details>
      <summary title="개별 컨텍스트 항목을 선택하여 복사합니다">Advanced options</summary>
      <div class="advanced-buttons">
        <button class="send-btn secondary" data-type="file"
          title="현재 편집 중인 파일 전체를 마크다운 코드 블록으로 클립보드에 복사합니다. (Ctrl+Shift+C)">
          📄 Current File
        </button>
        <button class="send-btn secondary" data-type="selection"
          title="에디터에서 선택된 텍스트를 마크다운 코드 블록으로 복사합니다.">
          📌 Selection
        </button>
        <button class="send-btn secondary" data-type="errors"
          title="컴파일 에러/경고와 주변 코드 컨텍스트(15줄)를 복사합니다. 에러 수정 요청 시 사용하세요.">
          ⚠️ Errors &amp; Warnings
        </button>
        <button class="send-btn secondary" data-type="gitDiff"
          title="현재 Git 변경 사항(diff)을 복사합니다. 코드 리뷰 요청 시 사용하세요.">
          🔀 Git Diff
        </button>
        <button class="send-btn secondary" data-type="gitLog"
          title="최근 Git 커밋 로그를 복사합니다. 기본값: 최근 10개 커밋.">
          📜 Git Log
        </button>
        <button class="send-btn secondary" data-type="buildLog"
          title="마지막 빌드/테스트 실행 결과 로그를 복사합니다.">
          📋 Build Log
        </button>
        <hr>
        <button class="send-btn" id="btnBuild"
          title="빌드 명령을 실행하고 결과를 클립보드에 복사합니다. 설정: codebreeze.buildCommands">
          🔨 Run Build &amp; Copy
        </button>
        <button class="send-btn" id="btnTest"
          title="테스트 명령을 실행하고 결과를 클립보드에 복사합니다. 설정: codebreeze.testCommands">
          🧪 Run Test &amp; Copy
        </button>
      </div>
    </details>
  </div>

  <!-- ── RECEIVE Tab ── -->
  <div class="tab-content hidden" id="tab-receive">
    <div class="watch-row">
      <span class="status-dot" id="watchDot"
        title="Auto-watch 상태: 빨간색=OFF, 초록색=ON"></span>
      <button class="secondary" id="btnToggleWatch"
        title="클립보드를 1초마다 감시하여 새 코드 블록이 감지되면 알림을 표시합니다.">
        Auto-watch: OFF
      </button>
      <button class="secondary icon" id="btnRefresh"
        title="클립보드에서 코드 블록을 지금 즉시 읽어옵니다.">🔄</button>
    </div>

    <div id="blocksContainer">
      <div class="no-blocks" id="noBlocks">
        클립보드에 코드 블록 없음.<br>
        🔄 새로고침 또는 Auto-watch를 켜세요.
      </div>
    </div>

    <div id="applyAllRow" style="display:none; padding-top:4px; flex-shrink:0;">
      <button id="btnApplyAll" style="width:100%;"
        title="클립보드의 모든 코드 블록을 워크스페이스 파일에 일괄 적용합니다. 적용 전 git stash 백업이 생성됩니다. (Ctrl+Shift+A)">
        ✅ Apply All
      </button>
    </div>
  </div>

  <!-- ── HISTORY Tab ── -->
  <div class="tab-content hidden" id="tab-history">
    <div id="historyContainer">
      <div class="no-blocks">기록 없음.<br>코드를 적용하면 여기에 표시됩니다.</div>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let blocks = [];
    let watching = false;

    // ── Tab switching ──
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        tab.classList.add('active');
        document.getElementById('tab-' + tab.dataset.tab).classList.remove('hidden');

        // Load history when switching to history tab
        if (tab.dataset.tab === 'history') {
          vscode.postMessage({ command: 'requestHistory' });
        }
      });
    });

    // ── Send tab ──
    document.getElementById('btnSmartContext').addEventListener('click', () => {
      vscode.postMessage({ command: 'sendContext', types: ['file', 'errors', 'gitDiff'] });
    });
    document.getElementById('btnOpenChat').addEventListener('click', () => {
      vscode.postMessage({ command: 'openChat' });
    });
    document.getElementById('btnBuild').addEventListener('click', () => {
      vscode.postMessage({ command: 'runBuild' });
    });
    document.getElementById('btnTest').addEventListener('click', () => {
      vscode.postMessage({ command: 'runTest' });
    });

    // Advanced individual send buttons
    document.querySelectorAll('.send-btn[data-type]').forEach(btn => {
      btn.addEventListener('click', () => {
        vscode.postMessage({ command: 'sendContext', types: [btn.dataset.type] });
      });
    });

    // ── Receive tab ──
    document.getElementById('btnRefresh').addEventListener('click', () => {
      vscode.postMessage({ command: 'refreshClipboard' });
    });
    document.getElementById('btnApplyAll').addEventListener('click', () => {
      vscode.postMessage({ command: 'applyAll' });
    });
    document.getElementById('btnToggleWatch').addEventListener('click', () => {
      watching = !watching;
      updateWatchUI();
      vscode.postMessage({ command: 'toggleWatch', enabled: watching });
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
      const applyAllRow = document.getElementById('applyAllRow');

      container.querySelectorAll('.code-block-item').forEach(el => el.remove());

      if (!blocks || blocks.length === 0) {
        noBlocks.style.display = 'block';
        applyAllRow.style.display = 'none';
        return;
      }

      noBlocks.style.display = 'none';
      applyAllRow.style.display = blocks.length > 1 ? 'block' : 'none';

      blocks.forEach((block, idx) => {
        const item = document.createElement('div');
        item.className = 'code-block-item';

        const header = document.createElement('div');
        header.className = 'code-block-header';

        const filename = document.createElement('span');
        filename.className = 'code-block-filename';
        filename.textContent = block.filePath || ('Block ' + (idx+1) + ' (' + (block.language || 'unknown') + ')');
        filename.title = block.filePath ? ('파일: ' + block.filePath) : ('언어: ' + (block.language || 'unknown'));

        const applyBtn = document.createElement('button');
        applyBtn.className = 'icon';
        applyBtn.textContent = '✅ Apply';
        applyBtn.title = (block.filePath ? block.filePath + '에' : '이 블록을') + ' 적용합니다. 적용 전 git stash 백업이 생성됩니다.';
        applyBtn.addEventListener('click', () => {
          vscode.postMessage({ command: 'applyBlock', index: idx });
        });

        header.appendChild(filename);
        header.appendChild(applyBtn);

        const preview = document.createElement('div');
        preview.className = 'code-block-preview';
        const lines = block.content.split('\\n');
        preview.textContent = lines.slice(0, 5).join('\\n') + (lines.length > 5 ? '\\n...' : '');

        item.appendChild(header);
        item.appendChild(preview);
        container.insertBefore(item, noBlocks);
      });
    }

    // ── History tab ──
    function renderHistory(history) {
      const container = document.getElementById('historyContainer');
      container.innerHTML = '';

      if (!history || history.length === 0) {
        container.innerHTML = '<div class="no-blocks">기록 없음.<br>코드를 적용하면 여기에 표시됩니다.</div>';
        return;
      }

      history.forEach((entry, idx) => {
        const item = document.createElement('div');
        item.className = 'history-item';

        const row = document.createElement('div');
        row.className = 'history-item-row';

        const label = document.createElement('span');
        label.className = 'history-item-label';
        const time = new Date(entry.timestamp).toLocaleTimeString();
        label.textContent = time + ' — ' + entry.fileCount + ' file(s)';

        row.appendChild(label);

        if (entry.undoAvailable && idx === 0) {
          const undoBtn = document.createElement('button');
          undoBtn.className = 'secondary icon';
          undoBtn.textContent = '↩ Undo';
          undoBtn.title = '마지막 적용을 취소하고 git stash에서 복원합니다. (Ctrl+Shift+U)';
          undoBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'undoApply' });
          });
          row.appendChild(undoBtn);
        }

        item.appendChild(row);
        container.appendChild(item);
      });
    }

    // ── Message handler ──
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
        case 'updateHistory':
          renderHistory(msg.history);
          break;
        case 'showLoading':
          document.getElementById('noBlocks').textContent = msg.text || 'Loading...';
          document.getElementById('noBlocks').style.display = 'block';
          break;
      }
    });

    // Initial load
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
