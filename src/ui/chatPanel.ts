import * as vscode from 'vscode';
import { parseClipboard } from '../apply/markdownParser';
import { applyFromClipboard } from '../apply/clipboardApply';
import { buildContextPayload } from '../collect/smartContext';
import { runBuildAndCopy, runTestAndCopy } from '../collect/localBuildCollector';
import { getConfig } from '../config';
import { generateControlPanelHtml, getNonce } from './chatPanelHtml';
import { CodeBlock } from '../types';

let controlPanel: vscode.WebviewPanel | undefined;
let clipboardWatcher: ReturnType<typeof setInterval> | undefined;
let lastClipboardText = '';

export async function openChatPanel(): Promise<void> {
  const config = getConfig();
  vscode.commands.executeCommand('simpleBrowser.show', config.chatUrl);
}

export function openControlPanel(context: vscode.ExtensionContext): void {
  if (controlPanel) {
    controlPanel.reveal(vscode.ViewColumn.Two);
    return;
  }

  controlPanel = vscode.window.createWebviewPanel(
    'codebreezeControl',
    'CodeBreeze',
    vscode.ViewColumn.Two,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    }
  );

  const nonce = getNonce();
  controlPanel.webview.html = generateControlPanelHtml(controlPanel.webview, nonce);

  // Handle messages from webview
  controlPanel.webview.onDidReceiveMessage(
    async (msg) => {
      switch (msg.command) {
        case 'refreshClipboard':
          await refreshClipboardBlocks();
          break;

        case 'applyBlock': {
          const text = await vscode.env.clipboard.readText();
          const blocks = parseClipboard(text);
          if (blocks[msg.index]) {
            await applySingleBlock(blocks[msg.index]);
          }
          break;
        }

        case 'applyAll':
          await applyFromClipboard();
          break;

        case 'sendContext': {
          const payload = await buildContextPayload(msg.types || []);
          if (payload) {
            await vscode.env.clipboard.writeText(payload);
            vscode.window.showInformationMessage('CodeBreeze: Context copied — paste into AI chat');
          }
          break;
        }

        case 'openChat':
          await openChatPanel();
          break;

        case 'toggleWatch':
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
      }
    },
    undefined,
    context.subscriptions
  );

  // Auto-watch if configured
  const config = getConfig();
  if (config.autoWatchClipboard) {
    startClipboardWatch();
    controlPanel.webview.postMessage({ command: 'setWatching', enabled: true });
  }

  controlPanel.onDidDispose(() => {
    stopClipboardWatch();
    controlPanel = undefined;
  });
}

async function refreshClipboardBlocks(): Promise<void> {
  if (!controlPanel) return;
  const text = await vscode.env.clipboard.readText();
  const blocks = parseClipboard(text);
  controlPanel.webview.postMessage({ command: 'updateBlocks', blocks });
}

function startClipboardWatch(): void {
  if (clipboardWatcher) return;
  clipboardWatcher = setInterval(async () => {
    if (!controlPanel) {
      stopClipboardWatch();
      return;
    }
    const text = await vscode.env.clipboard.readText();
    if (text !== lastClipboardText) {
      lastClipboardText = text;
      const blocks = parseClipboard(text);
      if (blocks.length > 0) {
        controlPanel.webview.postMessage({ command: 'updateBlocks', blocks });
        const config = getConfig();
        if (config.autoLevel !== 'off') {
          vscode.window
            .showInformationMessage(
              `CodeBreeze: ${blocks.length} code block(s) detected in clipboard`,
              'Open Panel'
            )
            .then((choice) => {
              if (choice === 'Open Panel') controlPanel?.reveal();
            });
        }
      }
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
  // Import here to avoid circular deps
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
  controlPanel?.webview.postMessage({ command: 'updateBlocks', blocks });
}
