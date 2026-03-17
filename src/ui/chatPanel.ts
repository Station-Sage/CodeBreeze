import * as vscode from 'vscode';
import { parseClipboard } from '../apply/markdownParser';
import { applyFromClipboard } from '../apply/clipboardApply';
import { buildContextPayload } from '../collect/smartContext';
import { runBuildAndCopy, runTestAndCopy } from '../collect/localBuildCollector';
import { getConfig } from '../config';
import { readClipboard, writeClipboard } from '../utils/clipboardCompat';
import { generateControlPanelHtml, getNonce } from './chatPanelHtml';
import { CodeBlock } from '../types';
import { getHistory } from './historyStore';
import { previewCodeBlock } from '../apply/diffPreview';

let panelWebview: vscode.Webview | undefined;
let clipboardWatcher: ReturnType<typeof setInterval> | undefined;
let lastClipboardText = '';
let autoWatchEnabled = false;

export function isAutoWatchEnabled(): boolean {
  return autoWatchEnabled;
}

export function setAutoWatch(enabled: boolean): void {
  autoWatchEnabled = enabled;
  if (enabled) {
    startClipboardWatch();
  } else {
    stopClipboardWatch();
  }
  panelWebview?.postMessage({ command: 'setWatching', enabled });
}

export class CodebreezeWebviewViewProvider implements vscode.WebviewViewProvider {
  constructor(private readonly _context: vscode.ExtensionContext) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    panelWebview = webviewView.webview;

    webviewView.webview.options = {
      enableScripts: true,
    };

    const nonce = getNonce();
    webviewView.webview.html = generateControlPanelHtml(webviewView.webview, nonce);

    setupMessageHandler(webviewView.webview, this._context);

    const config = getConfig();
    if (config.autoWatchClipboard) {
      autoWatchEnabled = true;
      startClipboardWatch();
      webviewView.webview.postMessage({ command: 'setWatching', enabled: true });
    }

    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        refreshClipboardBlocks();
        sendHistoryUpdate();
      }
    });

    webviewView.onDidDispose(() => {
      if (panelWebview === webviewView.webview) {
        panelWebview = undefined;
      }
      stopClipboardWatch();
    });
  }
}

function setupMessageHandler(webview: vscode.Webview, context: vscode.ExtensionContext): void {
  webview.onDidReceiveMessage(
    async (msg) => {
      switch (msg.command) {
        case 'refreshClipboard':
          await refreshClipboardBlocks();
          break;

        case 'applyBlock': {
          try {
            const text = await readClipboard();
            const blocks = parseClipboard(text);
            if (blocks[msg.index]) {
              await applySingleBlock(blocks[msg.index]);
            }
          } catch (err) {
            vscode.window.showErrorMessage(`CodeBreeze: Apply failed — ${err instanceof Error ? err.message : String(err)}`);
          }
          break;
        }

        case 'applyAll':
          await applyFromClipboard();
          break;

        case 'sendContext': {
          try {
            const payload = await buildContextPayload(msg.types || []);
            if (payload) {
              await writeClipboard(payload);
              vscode.window.showInformationMessage('CodeBreeze: Context copied — paste into AI chat');
            }
          } catch (err) {
            vscode.window.showErrorMessage(`CodeBreeze: Context copy failed — ${err instanceof Error ? err.message : String(err)}`);
          }
          break;
        }

        case 'openChat':
          await openChatPanel();
          break;

        case 'toggleWatch':
          autoWatchEnabled = msg.enabled;
          if (msg.enabled) {
            startClipboardWatch();
          } else {
            stopClipboardWatch();
          }
          break;

        case 'runBuild':
          await runBuildAndCopy();
          await refreshClipboardBlocks();
          break;

        case 'runTest':
          await runTestAndCopy();
          await refreshClipboardBlocks();
          break;

        case 'requestHistory':
          sendHistoryUpdate();
          break;

        case 'undoApply': {
          const { undoLastApply } = await import('../apply/safetyGuard');
          await undoLastApply();
          sendHistoryUpdate();
          break;
        }

        case 'previewBlock': {
          try {
            const text = await readClipboard();
            const blocks = parseClipboard(text);
            const block = blocks[msg.index];
            if (block) {
              const diff = await previewCodeBlock(block);
              webview.postMessage({ command: 'showDiff', index: msg.index, diff });
            }
          } catch (err) {
            console.warn('[CodeBreeze] previewBlock failed:', err);
          }
          break;
        }
      }
    },
    undefined,
    context.subscriptions
  );
}

export async function openChatPanel(): Promise<void> {
  const config = getConfig();
  await vscode.env.openExternal(vscode.Uri.parse(config.chatUrl));
}

export async function openControlPanel(_context: vscode.ExtensionContext): Promise<void> {
  await vscode.commands.executeCommand('workbench.view.extension.codebreeze-chat');
  await vscode.commands.executeCommand('codebreezePanelView.focus');
}

async function refreshClipboardBlocks(): Promise<void> {
  if (!panelWebview) return;
  try {
    const text = await readClipboard();
    const blocks = parseClipboard(text);
    panelWebview.postMessage({ command: 'updateBlocks', blocks });
  } catch (err) {
    console.warn('[CodeBreeze] refreshClipboardBlocks failed:', err);
  }
}

function sendHistoryUpdate(): void {
  if (!panelWebview) return;
  const history = getHistory()
    .slice(0, 10)
    .map((entry) => ({
      id: entry.id,
      timestamp: entry.timestamp,
      fileCount: entry.results.filter((r) => r.status === 'applied').length,
      undoAvailable: entry.undoAvailable,
    }));
  panelWebview.postMessage({ command: 'updateHistory', history });
}

function startClipboardWatch(): void {
  if (clipboardWatcher) return;
  clipboardWatcher = setInterval(async () => {
    if (!panelWebview) {
      stopClipboardWatch();
      return;
    }
    try {
      const text = await readClipboard();
      if (text !== lastClipboardText) {
        lastClipboardText = text;
        const blocks = parseClipboard(text);
        if (blocks.length > 0) {
          panelWebview.postMessage({ command: 'updateBlocks', blocks });
          const config = getConfig();
          if (config.autoLevel !== 'off') {
            vscode.window
              .showInformationMessage(
                `CodeBreeze: ${blocks.length} code block(s) detected in clipboard`,
                'Open Panel'
              )
              .then((choice) => {
                if (choice === 'Open Panel') {
                  vscode.commands.executeCommand('workbench.view.extension.codebreeze-chat');
                  vscode.commands.executeCommand('codebreezePanelView.focus');
                }
              });
          }
        }
      }
    } catch (err) {
      console.warn('[CodeBreeze] autoWatch clipboard read failed:', err);
    }
  }, 1000);
}

function stopClipboardWatch(): void {
  if (clipboardWatcher) {
    clearInterval(clipboardWatcher);
    clipboardWatcher = undefined;
  }
}

async function applySingleBlock(block: CodeBlock): Promise<void> {
  const { resolveOrCreateFile } = await import('../apply/fileMatcher');
  const { createUndoPoint } = await import('../apply/safetyGuard');

  if (!block.filePath) {
    vscode.window.showWarningMessage('CodeBreeze: No file path in code block');
    return;
  }

  const uri = await resolveOrCreateFile(block.filePath);
  if (!uri) return;

  await createUndoPoint();

  const doc = await vscode.workspace.openTextDocument(uri);
  const editor = await vscode.window.showTextDocument(doc);
  const fullRange = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(doc.lineCount, 0));

  await editor.edit((e) => e.replace(fullRange, block.content));
  await doc.save();

  vscode.window.showInformationMessage(`CodeBreeze: Applied to ${block.filePath}`);
}

export function updateControlPanel(blocks: CodeBlock[]): void {
  panelWebview?.postMessage({ command: 'updateBlocks', blocks });
}
