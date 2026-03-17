// src/ui/chatPanelStyles.ts
// CSS styles for the CodeBreeze control panel webview.

export function getControlPanelStyles(): string {
  return `
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
    button.danger {
      background: var(--vscode-inputValidation-errorBackground);
      color: var(--vscode-errorForeground);
    }
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
    details summary::before { content: '\\25B6 '; font-size: 9px; }
    details[open] summary::before { content: '\\25BC '; font-size: 9px; }
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
    .diff-panel {
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 11px;
      overflow-x: auto;
      max-height: 200px;
      background: var(--vscode-editor-background);
      border-top: 1px solid var(--vscode-widget-border);
      padding: 4px 0;
    }
    .diff-line { display: flex; white-space: pre; }
    .diff-line.added { background: rgba(0,200,100,0.12); color: var(--vscode-charts-green); }
    .diff-line.removed { background: rgba(200,50,50,0.12); color: var(--vscode-charts-red); }
    .diff-line.context { color: var(--vscode-editor-foreground); opacity: 0.75; }
    .diff-line-marker { width: 1.4em; text-align: center; flex-shrink: 0; user-select: none; }
    .diff-line-content { padding: 0 6px; }
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
  `;
}
