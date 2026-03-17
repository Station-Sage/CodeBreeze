// src/ui/chatPanelScript.ts
// JavaScript for the CodeBreeze control panel webview.

export function getControlPanelScript(): string {
  return `
    const vscode = acquireVsCodeApi();
    let blocks = [];
    let watching = false;
    let agentLoopRunning = false;

    // ── Tab switching ──
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        tab.classList.add('active');
        document.getElementById('tab-' + tab.dataset.tab).classList.remove('hidden');
        if (tab.dataset.tab === 'history') {
          vscode.postMessage({ command: 'requestHistory' });
        }
      });
    });

    // ── Bridge tab handlers ──
    document.getElementById('btnStartBridge').addEventListener('click', () => {
      vscode.postMessage({ command: 'startBridge' });
    });
    document.getElementById('btnStopBridge').addEventListener('click', () => {
      vscode.postMessage({ command: 'stopBridge' });
    });
    document.getElementById('btnBridgeSend').addEventListener('click', () => {
      const input = document.getElementById('bridgeInput');
      const text = input.value.trim();
      if (!text) return;
      vscode.postMessage({ command: 'bridgeSendToAI', payload: text });
      appendBridgeMessage('user', text);
      input.value = '';
    });
    document.getElementById('btnBridgeSendContext').addEventListener('click', () => {
      vscode.postMessage({ command: 'bridgeSendContext' });
    });
    document.getElementById('btnAgentLoop').addEventListener('click', () => {
      if (agentLoopRunning) {
        vscode.postMessage({ command: 'stopAgentLoop' });
      } else {
        vscode.postMessage({ command: 'startAgentLoop' });
      }
    });

    function appendBridgeMessage(role, text) {
      document.getElementById('noBridgeMessages').style.display = 'none';
      const container = document.getElementById('bridgeChatHistory');
      const el = document.createElement('div');
      el.style.cssText = 'padding:4px 8px; border-radius:4px; font-size:11px; max-height:120px; overflow-y:auto;'
        + (role === 'user'
          ? 'background:var(--vscode-button-background); color:var(--vscode-button-foreground); align-self:flex-end; max-width:85%;'
          : role === 'ai'
            ? 'background:var(--vscode-editor-lineHighlightBackground); align-self:flex-start; max-width:85%;'
            : 'background:var(--vscode-editorWidget-background); color:var(--vscode-descriptionForeground); align-self:center; font-style:italic;');
      el.textContent = text.length > 500 ? text.substring(0, 500) + '...' : text;
      container.appendChild(el);
      container.scrollTop = container.scrollHeight;
    }

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

    function updateAgentLoopUI(running) {
      agentLoopRunning = running;
      const btn = document.getElementById('btnAgentLoop');
      btn.textContent = running ? 'Stop Agent Loop' : 'Agent Loop';
      btn.className = running ? 'secondary danger' : 'secondary';
      btn.style.flex = '1';
      btn.style.fontSize = '11px';
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

        const previewBtn = document.createElement('button');
        previewBtn.className = 'secondary icon';
        previewBtn.textContent = '\\uD83D\\uDD0D';
        previewBtn.title = 'Preview diff';
        previewBtn.addEventListener('click', () => {
          vscode.postMessage({ command: 'previewBlock', index: idx });
          previewBtn.textContent = '\\u23F3';
          previewBtn.disabled = true;
        });

        const applyBtn = document.createElement('button');
        applyBtn.className = 'icon';
        applyBtn.textContent = '\\u2705 Apply';
        applyBtn.addEventListener('click', () => {
          vscode.postMessage({ command: 'applyBlock', index: idx });
        });

        header.appendChild(filename);
        header.appendChild(previewBtn);
        header.appendChild(applyBtn);

        const preview = document.createElement('div');
        preview.className = 'code-block-preview';
        const lines = block.content.split('\\\\n');
        preview.textContent = lines.slice(0, 5).join('\\\\n') + (lines.length > 5 ? '\\\\n...' : '');

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
        container.innerHTML = '<div class="no-blocks">No history yet.</div>';
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
        label.textContent = time + ' \\u2014 ' + entry.fileCount + ' file(s)';
        row.appendChild(label);

        if (entry.undoAvailable && idx === 0) {
          const undoBtn = document.createElement('button');
          undoBtn.className = 'secondary icon';
          undoBtn.textContent = '\\u21A9 Undo';
          undoBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'undoApply' });
          });
          row.appendChild(undoBtn);
        }

        item.appendChild(row);
        container.appendChild(item);
      });
    }

    // ── Diff rendering helper ──
    function renderDiffPanel(item, diff) {
      const existing = item.querySelector('.diff-panel');
      if (existing) { existing.remove(); return; }
      if (!diff) return;

      const panel = document.createElement('div');
      panel.className = 'diff-panel';
      const { lines, exists, filePath } = diff;
      if (!exists) {
        const hdr = document.createElement('div');
        hdr.style.cssText = 'padding:2px 8px;font-size:10px;color:var(--vscode-charts-green)';
        hdr.textContent = '+ New file: ' + filePath;
        panel.appendChild(hdr);
      }
      (lines || []).forEach(l => {
        const row = document.createElement('div');
        row.className = 'diff-line ' + l.type;
        const marker = document.createElement('span');
        marker.className = 'diff-line-marker';
        marker.textContent = l.type === 'added' ? '+' : l.type === 'removed' ? '-' : ' ';
        const content = document.createElement('span');
        content.className = 'diff-line-content';
        content.textContent = l.content;
        row.appendChild(marker);
        row.appendChild(content);
        panel.appendChild(row);
      });
      if (lines && lines.length === 0) {
        panel.textContent = 'No changes';
        panel.style.padding = '4px 8px';
      }
      item.appendChild(panel);
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
        case 'showDiff': {
          const items = document.querySelectorAll('.code-block-item');
          const item = items[msg.index];
          if (!item) break;
          const btn = item.querySelector('.secondary.icon');
          if (btn) { btn.textContent = '\\uD83D\\uDD0D'; btn.disabled = false; }
          renderDiffPanel(item, msg.diff);
          break;
        }
        case 'bridgeStatus': {
          document.getElementById('bridgeDot').className = 'status-dot' + (msg.running ? ' active' : '');
          document.getElementById('bridgeStatus').textContent = msg.running
            ? 'Bridge: ws://127.0.0.1:' + msg.port + ' (' + msg.clients + ' client(s))'
            : 'Bridge: Stopped';
          break;
        }
        case 'bridgeAIResponse':
          appendBridgeMessage('ai', msg.text);
          break;
        case 'bridgeUserSent':
          appendBridgeMessage('user', msg.text);
          break;
        case 'agentLoopUpdate':
          appendBridgeMessage('system', msg.text);
          if (msg.text.includes('started')) updateAgentLoopUI(true);
          if (msg.text.includes('finished') || msg.text.includes('stopped') || msg.text.includes('complete')
              || msg.text.includes('aborted') || msg.text.includes('error') || msg.text.includes('timeout')
              || msg.text.includes('Stopping')) updateAgentLoopUI(false);
          break;
      }
    });

    // Initial load
    vscode.postMessage({ command: 'refreshClipboard' });
  `;
}
