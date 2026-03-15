import * as vscode from 'vscode';

// Apply
import { applyFromClipboard } from './apply/clipboardApply';
import { undoLastApply } from './apply/safetyGuard';

// Collect
import { copyFileForAI, copySelectionForAI, copyMultipleFilesForAI } from './collect/fileCopy';
import { copyGitDiffForAI, copyGitLogForAI } from './collect/gitCollector';
import { copyErrorsForAI } from './collect/errorCollector';
import { runBuildAndCopy, runTestAndCopy, copyLastBuildLog } from './collect/localBuildCollector';
import { copyBuildLogFromGitHub } from './collect/githubLogCollector';
import { copySmartContext } from './collect/smartContext';
import { copyProjectMap } from './collect/projectMapCollector';
import { startMcpServer, stopMcpServer } from './mcp/mcpServer';
import { startWsBridge, stopWsBridge } from './bridge/wsBridgeServer';
import { showManualPastePanel } from './utils/clipboardCompat';

// UI
import { CodeBreezeSidebarProvider } from './ui/sidebarProvider';
import { initHistoryStore } from './ui/historyStore';
import { initStatusBar, flashStatusBar } from './ui/statusBarItem';
import { openChatPanel, openControlPanel, CodebreezeWebviewViewProvider, isAutoWatchEnabled, setAutoWatch } from './ui/chatPanel';

// Monitor
import { registerTaskMonitor } from './monitor/taskMonitor';
import { registerTerminalMonitor } from './monitor/terminalMonitor';
import { registerDiagnosticsMonitor, onDiagnosticsChanged } from './monitor/diagnosticsMonitor';
import { registerGitEventMonitor } from './monitor/gitEventMonitor';

export function activate(context: vscode.ExtensionContext): void {
  // Initialize stores
  initHistoryStore(context);
  initStatusBar(context);

  // Register sidebar
  const sidebarProvider = new CodeBreezeSidebarProvider();
  const sidebarDisposable = vscode.window.registerTreeDataProvider(
    'codebreezeSidebar',
    sidebarProvider
  );
  context.subscriptions.push(sidebarDisposable);

  // Register secondary sidebar WebviewView provider
  const panelProvider = new CodebreezeWebviewViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('codebreezePanelView', panelProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  // Register monitors
  registerTaskMonitor(context);
  registerTerminalMonitor(context);
  registerDiagnosticsMonitor(context);
  registerGitEventMonitor(context);

  // Update status bar on diagnostics change
  onDiagnosticsChanged((errors, _warnings) => {
    if (errors > 0) {
      flashStatusBar(`${errors} error(s)`, 5000);
    }
    sidebarProvider.refresh();
  });

  // Register all commands
  const commands: [string, (...args: unknown[]) => unknown][] = [
    ['codebreeze.applyFromClipboard', () => applyFromClipboard()],
    ['codebreeze.undoLastApply', () => undoLastApply()],
    ['codebreeze.copyFileForAI', (uri?: unknown) => copyFileForAI(uri as vscode.Uri | undefined)],
    ['codebreeze.copySelectionForAI', () => copySelectionForAI()],
    ['codebreeze.copyGitDiffForAI', () => copyGitDiffForAI()],
    ['codebreeze.copyGitLogForAI', () => copyGitLogForAI()],
    ['codebreeze.copyErrorsForAI', () => copyErrorsForAI()],
    ['codebreeze.runBuildAndCopy', () => runBuildAndCopy()],
    ['codebreeze.runTestAndCopy', () => runTestAndCopy()],
    ['codebreeze.copyLastBuildLog', () => copyLastBuildLog()],
    ['codebreeze.copyBuildLogFromGitHub', () => copyBuildLogFromGitHub()],
    ['codebreeze.copyMultipleFilesForAI', (uris?: unknown) => copyMultipleFilesForAI((uris as vscode.Uri[]) || [])],
    ['codebreeze.copySmartContext', () => copySmartContext()],
    ['codebreeze.copyProjectMap', () => copyProjectMap()],
    ['codebreeze.startMcpServer', () => startMcpServer(context)],
    ['codebreeze.stopMcpServer', () => stopMcpServer()],
    ['codebreeze.startWsBridge', () => startWsBridge(context)],
    ['codebreeze.stopWsBridge', () => stopWsBridge()],
    ['codebreeze.manualPaste', () => showManualPastePanel(context)],
    ['codebreeze.openChatPanel', () => openChatPanel()],
    ['codebreeze.openControlPanel', () => openControlPanel(context)],
    ['codebreeze.refreshSidebar', () => sidebarProvider.refresh()],
    ['codebreeze.toggleAutoWatch', () => {
      setAutoWatch(!isAutoWatchEnabled());
      sidebarProvider.refresh();
    }],
  ];

  for (const [id, handler] of commands) {
    context.subscriptions.push(vscode.commands.registerCommand(id, handler));
  }
}

export function deactivate(): void {
  // Cleanup handled by subscriptions
}
