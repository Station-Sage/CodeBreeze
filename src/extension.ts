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

  // Start LSP incremental indexer (Phase 10)
  import('./collect/lspIndexer').then(({ startIncrementalWatcher }) => {
    context.subscriptions.push(startIncrementalWatcher());
  }).catch(() => { /* LSP indexer optional */ });

  // Register inline completion provider (Phase 11)
  import('./providers/inlineCompletionProvider').then(({ CodeBreezeInlineCompletionProvider }) => {
    const provider = new CodeBreezeInlineCompletionProvider();
    context.subscriptions.push(
      vscode.languages.registerInlineCompletionItemProvider({ pattern: '**' }, provider)
    );
  }).catch(() => { /* Inline completion optional */ });

  // Auto-start background agent if configured (Phase 11)
  import('./bridge/backgroundAgent').then(({ startBackgroundAgent }) => {
    const bgMode = vscode.workspace.getConfiguration('codebreeze').get<string>('backgroundAgentMode');
    if (bgMode && bgMode !== 'off') {
      startBackgroundAgent(context);
    }
  }).catch(() => { /* Background agent optional */ });

  // Update status bar on diagnostics change
  onDiagnosticsChanged((errors, _warnings) => {
    if (errors > 0) {
      flashStatusBar(`${errors} error(s)`, 5000);
    }
    sidebarProvider.refresh();
  });

  // Register all commands
  const commands: [string, (...args: unknown[]) => unknown][] = [
    ['codebreeze.startMcpServer', async () => {
      const { startMcpServer } = await import('./mcp/mcpServer');
      return startMcpServer(context);
    }],
    ['codebreeze.stopMcpServer', async () => {
      const { stopMcpServer } = await import('./mcp/mcpServer');
      return stopMcpServer();
    }],
    ['codebreeze.startWsBridge', async () => {
      const { startWsBridge } = await import('./bridge/wsBridgeServer');
      return startWsBridge(context);
    }],
    ['codebreeze.stopWsBridge', async () => {
      const { stopWsBridge } = await import('./bridge/wsBridgeServer');
      return stopWsBridge();
    }],
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
    ['codebreeze.manualPaste', () => showManualPastePanel(context)],
    ['codebreeze.openChatPanel', () => openChatPanel()],
    ['codebreeze.openControlPanel', () => openControlPanel(context)],
    ['codebreeze.refreshSidebar', () => sidebarProvider.refresh()],
    ['codebreeze.toggleAutoWatch', () => {
      setAutoWatch(!isAutoWatchEnabled());
      sidebarProvider.refresh();
    }],
    ['codebreeze.fixErrorWithAI', async () => {
      const { fixErrorWithAI } = await import('./commands/fixWithAI');
      return fixErrorWithAI();
    }],
    ['codebreeze.indexWorkspace', async () => {
      const { indexWorkspace, getIndexedFileCount } = await import('./collect/lspIndexer');
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'CodeBreeze: Indexing workspace...' },
        async () => { await indexWorkspace(true); }
      );
      vscode.window.showInformationMessage(`CodeBreeze: Indexed ${getIndexedFileCount()} files`);
    }],
    ['codebreeze.copyLspProjectMap', async () => {
      const { getLspProjectMap } = await import('./collect/lspIndexer');
      const map = await getLspProjectMap();
      if (!map) {
        vscode.window.showInformationMessage('CodeBreeze: No LSP symbols found (try indexing first)');
        return;
      }
      await vscode.env.clipboard.writeText(map);
      vscode.window.showInformationMessage('CodeBreeze: LSP project map copied to clipboard');
    }],
    ['codebreeze.toggleBackgroundAgent', async () => {
      const { toggleBackgroundAgent } = await import('./bridge/backgroundAgent');
      toggleBackgroundAgent(context);
    }],
    ['codebreeze.triggerInlineCompletion', async () => {
      const { triggerInlineCompletion } = await import('./providers/inlineCompletionProvider');
      return triggerInlineCompletion();
    }],
  ];

  for (const [id, handler] of commands) {
    context.subscriptions.push(vscode.commands.registerCommand(id, handler));
  }
}

export function deactivate(): void {
  // Cleanup handled by subscriptions
}
