/**
 * Clipboard compatibility layer — I-001 (code-server fallback)
 *
 * In code-server (browser) environments, vscode.env.clipboard
 * may fail silently or require HTTPS + user permission.
 * This module wraps clipboard access with a file-based fallback.
 *
 * Fallback file: <workspaceRoot>/.codebreeze-clipboard.md
 */
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getWorkspaceRoot } from '../config';

const FALLBACK_FILENAME = '.codebreeze-clipboard.md';
const CLIPBOARD_TIMEOUT_MS = 2000;

/** Cached result of clipboard availability test */
let clipboardAvailable: boolean | null = null;

function withTimeout<T>(thenable: Thenable<T> | Promise<T>, ms: number, fallback: T): Promise<T> {
  const wrapped = Promise.resolve(thenable);
  return Promise.race([
    wrapped,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

function getFallbackPath(): string | null {
  const root = getWorkspaceRoot();
  return root ? path.join(root, FALLBACK_FILENAME) : null;
}

/** Detect code-server / browser-based VS Code environments */
function isCodeServer(): boolean {
  // vscode.env.uriScheme is 'vscode' for desktop, 'http'/'https' for code-server
  const scheme = vscode.env.uriScheme;
  if (scheme === 'http' || scheme === 'https') return true;

  // Fallback: check known env vars
  return !!(process.env.VSCODE_AGENT_FOLDER || process.env.CS_DISABLE_FILE_DOWNLOADS);
}

/**
 * Write text to clipboard with code-server fallback.
 * Returns true if clipboard write succeeded, false if fallback was used.
 */
export async function writeClipboard(text: string): Promise<boolean> {
  // Skip clipboard attempt if previously detected as unavailable
  if (clipboardAvailable !== false) {
    try {
      await withTimeout(vscode.env.clipboard.writeText(text), CLIPBOARD_TIMEOUT_MS, undefined);
      const readBack = await withTimeout(vscode.env.clipboard.readText(), CLIPBOARD_TIMEOUT_MS, '');
      if (readBack === text) {
        clipboardAvailable = true;
        return true;
      }
    } catch {
      // fall through to file fallback
    }
    clipboardAvailable = false;
  }

  // File-based fallback
  const fbPath = getFallbackPath();
  if (fbPath) {
    try {
      fs.writeFileSync(fbPath, text, 'utf8');
      // Auto-open Manual Paste panel in code-server environments
      if (isCodeServer()) {
        vscode.window
          .showInformationMessage(
            `CodeBreeze: Clipboard unavailable — saved to ${FALLBACK_FILENAME}.`,
            'Open Manual Paste',
            'Open File'
          )
          .then((choice) => {
            if (choice === 'Open Manual Paste') {
              vscode.commands.executeCommand('codebreeze.manualPaste');
            } else if (choice === 'Open File') {
              vscode.workspace
                .openTextDocument(fbPath!)
                .then((doc) => vscode.window.showTextDocument(doc));
            }
          });
      }
      return false;
    } catch {
      vscode.window.showErrorMessage('CodeBreeze: Failed to write clipboard and fallback file');
    }
  }
  return false;
}

/**
 * Read text from clipboard with code-server fallback.
 * Falls back to reading .codebreeze-clipboard.md if clipboard is empty.
 */
export async function readClipboard(): Promise<string> {
  let text = '';
  try {
    text = await withTimeout(vscode.env.clipboard.readText(), CLIPBOARD_TIMEOUT_MS, '');
  } catch {
    // fall through
  }

  if (text.trim()) return text;

  // Try file fallback
  const fbPath = getFallbackPath();
  if (fbPath && fs.existsSync(fbPath)) {
    try {
      const fallback = fs.readFileSync(fbPath, 'utf8');
      if (fallback.trim()) {
        if (isCodeServer()) {
          vscode.window.showInformationMessage(
            `CodeBreeze: Reading from fallback file ${FALLBACK_FILENAME}`
          );
        }
        return fallback;
      }
    } catch {
      // ignore
    }
  }

  return text;
}

/** Show a WebView textarea for manual paste in environments where clipboard is fully blocked */
export function showManualPastePanel(context: vscode.ExtensionContext): void {
  const panel = vscode.window.createWebviewPanel(
    'codebreeze.manualPaste',
    'CodeBreeze: Paste Code',
    vscode.ViewColumn.Beside,
    { enableScripts: true }
  );

  panel.webview.html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: var(--vscode-font-family); padding: 12px; background: var(--vscode-editor-background); color: var(--vscode-editor-foreground); }
    textarea { width: 100%; height: 70vh; font-family: monospace; font-size: 12px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); padding: 8px; resize: vertical; }
    button { margin-top: 8px; padding: 6px 16px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; cursor: pointer; }
    p { font-size: 12px; color: var(--vscode-descriptionForeground); }
  </style>
</head>
<body>
  <p>AI 응답 코드를 아래에 붙여넣고 Apply를 클릭하세요 (code-server / 클립보드 불가 환경).</p>
  <textarea id="paste" placeholder="AI 응답 마크다운을 여기에 붙여넣기..."></textarea>
  <br>
  <button onclick="apply()">✅ Apply</button>
  <script>
    const vscode = acquireVsCodeApi();
    function apply() {
      const text = document.getElementById('paste').value;
      if (!text.trim()) return;
      vscode.postMessage({ command: 'applyPasted', text });
    }
  </script>
</body>
</html>`;

  panel.webview.onDidReceiveMessage(
    async (msg) => {
      if (msg.command === 'applyPasted') {
        const { parseClipboard } = await import('../apply/markdownParser');
        const { applyCodeBlocksHeadless } = await import('../apply/clipboardApply');
        const blocks = parseClipboard(msg.text);
        if (blocks.length === 0) {
          vscode.window.showInformationMessage('CodeBreeze: No code blocks found');
          return;
        }
        const results = await applyCodeBlocksHeadless(blocks);
        const applied = results.filter(
          (r) => r.status === 'applied' || r.status === 'created'
        ).length;
        vscode.window.showInformationMessage(`CodeBreeze: ${applied} block(s) applied`);
        panel.dispose();
      }
    },
    undefined,
    context.subscriptions
  );
}
