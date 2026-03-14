import * as vscode from 'vscode';
import { getHistory } from './historyStore';
import { countDiagnostics } from '../monitor/diagnosticsMonitor';

export class CodeBreezeSidebarProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeItem): TreeItem[] {
    if (!element) {
      return this.getRootItems();
    }

    switch (element.contextValue) {
      case 'apply':
        return this.getApplyItems();
      case 'collect':
        return this.getCollectItems();
      case 'monitor':
        return this.getMonitorItems();
      case 'history':
        return this.getHistoryItems();
      default:
        return [];
    }
  }

  private getRootItems(): TreeItem[] {
    return [
      new TreeItem('💬 Open AI Chat', vscode.TreeItemCollapsibleState.None, {
        command: 'codebreeze.openChatPanel',
        title: 'Open AI Chat',
      }),
      new TreeItem('🖥️ Control Panel', vscode.TreeItemCollapsibleState.None, {
        command: 'codebreeze.openControlPanel',
        title: 'Open Control Panel',
      }, 'panel'),
      new TreeItem('📥 Apply', vscode.TreeItemCollapsibleState.Collapsed, undefined, 'apply'),
      new TreeItem('📤 Collect', vscode.TreeItemCollapsibleState.Collapsed, undefined, 'collect'),
      new TreeItem('👁️ Monitor', vscode.TreeItemCollapsibleState.Collapsed, undefined, 'monitor'),
      new TreeItem('📋 History', vscode.TreeItemCollapsibleState.Collapsed, undefined, 'history'),
    ];
  }

  private getApplyItems(): TreeItem[] {
    return [
      new TreeItem('Apply Code from Clipboard (Ctrl+Shift+A)', vscode.TreeItemCollapsibleState.None, {
        command: 'codebreeze.applyFromClipboard',
        title: 'Apply Code from Clipboard',
      }),
      new TreeItem('Undo Last Apply', vscode.TreeItemCollapsibleState.None, {
        command: 'codebreeze.undoLastApply',
        title: 'Undo Last Apply',
      }),
    ];
  }

  private getCollectItems(): TreeItem[] {
    return [
      new TreeItem('Copy File for AI (Ctrl+Shift+C)', vscode.TreeItemCollapsibleState.None, {
        command: 'codebreeze.copyFileForAI',
        title: 'Copy File for AI',
      }),
      new TreeItem('Copy Selection for AI', vscode.TreeItemCollapsibleState.None, {
        command: 'codebreeze.copySelectionForAI',
        title: 'Copy Selection for AI',
      }),
      new TreeItem('Copy Errors for AI', vscode.TreeItemCollapsibleState.None, {
        command: 'codebreeze.copyErrorsForAI',
        title: 'Copy Errors for AI',
      }),
      new TreeItem('Copy Git Diff for AI', vscode.TreeItemCollapsibleState.None, {
        command: 'codebreeze.copyGitDiffForAI',
        title: 'Copy Git Diff',
      }),
      new TreeItem('Copy Git Log for AI', vscode.TreeItemCollapsibleState.None, {
        command: 'codebreeze.copyGitLogForAI',
        title: 'Copy Git Log',
      }),
      new TreeItem('Run Build & Copy', vscode.TreeItemCollapsibleState.None, {
        command: 'codebreeze.runBuildAndCopy',
        title: 'Run Build and Copy',
      }),
      new TreeItem('Run Tests & Copy', vscode.TreeItemCollapsibleState.None, {
        command: 'codebreeze.runTestAndCopy',
        title: 'Run Tests and Copy',
      }),
      new TreeItem('Copy Smart Context', vscode.TreeItemCollapsibleState.None, {
        command: 'codebreeze.copySmartContext',
        title: 'Copy Smart Context',
      }),
    ];
  }

  private getMonitorItems(): TreeItem[] {
    const { errors, warnings } = countDiagnostics();
    return [
      new TreeItem(`Errors: ${errors}  Warnings: ${warnings}`, vscode.TreeItemCollapsibleState.None, {
        command: 'codebreeze.copyErrorsForAI',
        title: 'Copy Errors',
      }),
    ];
  }

  private getHistoryItems(): TreeItem[] {
    const history = getHistory();
    if (history.length === 0) {
      return [new TreeItem('No history yet', vscode.TreeItemCollapsibleState.None)];
    }

    return history.slice(0, 10).map((entry) => {
      const date = new Date(entry.timestamp).toLocaleTimeString();
      const applied = entry.results.filter((r) => r.status === 'applied').length;
      const label = `${date} — ${applied} file(s) applied`;
      return new TreeItem(label, vscode.TreeItemCollapsibleState.None, undefined, 'historyEntry');
    });
  }
}

class TreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    command?: vscode.Command,
    public readonly contextValue?: string
  ) {
    super(label, collapsibleState);
    this.command = command;
  }
}
