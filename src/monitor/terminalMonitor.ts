import * as vscode from 'vscode';
import { getConfig } from '../config';

const ERROR_PATTERNS = [
  /\berror\b/i,
  /\bfailed\b/i,
  /\bfailure\b/i,
  /\bexception\b/i,
  /✗|×|✘/,
  /\bERROR\b/,
  /\bFAILED\b/,
];

// Buffer per terminal id
const terminalBuffers = new Map<string, string[]>();
let lastErrorNotifyTime = 0;

export function registerTerminalMonitor(context: vscode.ExtensionContext): void {
  // onDidWriteTerminalData is available in VS Code 1.68+
  if (!('onDidWriteTerminalData' in vscode.window)) return;

  const writeSub = (vscode.window as unknown as {
    onDidWriteTerminalData: (cb: (e: { terminal: vscode.Terminal; data: string }) => void) => vscode.Disposable;
  }).onDidWriteTerminalData((e) => {
    const key = getTerminalKey(e.terminal);
    if (!terminalBuffers.has(key)) {
      terminalBuffers.set(key, []);
    }
    const buf = terminalBuffers.get(key)!;
    buf.push(e.data);
    // Keep last 500 lines worth
    if (buf.length > 500) buf.splice(0, buf.length - 500);

    // Check for errors and notify (throttled to once per 3s)
    const config = getConfig();
    if (config.autoLevel !== 'off' && Date.now() - lastErrorNotifyTime > 3000) {
      if (ERROR_PATTERNS.some((p) => p.test(e.data))) {
        lastErrorNotifyTime = Date.now();
        if (config.autoLevel === 'auto') {
          // Emit event for panel update
          vscode.commands.executeCommand('codebreeze._terminalError', e.data.substring(0, 500));
        }
      }
    }
  });

  const closeSub = vscode.window.onDidCloseTerminal((terminal) => {
    const key = getTerminalKey(terminal);
    terminalBuffers.delete(key);
  });

  context.subscriptions.push(writeSub, closeSub);
}

export function getTerminalOutput(terminal?: vscode.Terminal): string {
  if (terminal) {
    return terminalBuffers.get(getTerminalKey(terminal))?.join('') || '';
  }
  // Get all terminal output combined
  const all: string[] = [];
  for (const [, buf] of terminalBuffers) {
    all.push(buf.join(''));
  }
  return all.join('\n--- terminal ---\n');
}

function getTerminalKey(terminal: vscode.Terminal): string {
  return terminal.name + '_' + (terminal.processId || '');
}
