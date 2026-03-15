import * as vscode from 'vscode';
import { getHistory } from './historyStore';
import { countDiagnostics } from '../monitor/diagnosticsMonitor';
import { isAutoWatchEnabled } from './chatPanel';

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
      case 'monitor':
        return this.getMonitorItems();
      case 'history':
        return this.getHistoryItems();
      default:
        return [];
    }
  }

  private getRootItems(): TreeItem[] {
    const watching = isAutoWatchEnabled();
    const watchLabel = watching ? '🟢 Auto-watch: ON' : '🔴 Auto-watch: OFF';
    const watchTooltip = new vscode.MarkdownString(
      watching
        ? '**Auto-watch 활성화됨**\n\n클립보드를 1초마다 감시 중입니다.\n\n클릭하여 끄기'
        : '**Auto-watch 비활성화됨**\n\n클릭하면 클립보드를 자동으로 감시합니다.\n새 코드 블록이 감지되면 알림이 표시됩니다.'
    );

    return [
      makeItem('💬 Open AI Chat', vscode.TreeItemCollapsibleState.None, {
        command: 'codebreeze.openChatPanel',
        title: 'Open AI Chat',
      }, undefined, new vscode.MarkdownString(
        '**AI Chat 열기**\n\n설정된 AI Chat URL을 Simple Browser로 엽니다.\n\n`Ctrl+Shift+H`'
      )),
      makeItem('🖥️ Control Panel', vscode.TreeItemCollapsibleState.None, {
        command: 'codebreeze.openControlPanel',
        title: 'Open Control Panel',
      }, 'panel', new vscode.MarkdownString(
        '**Control Panel 열기**\n\nSend / Receive / History 패널을 오른쪽 사이드바에 표시합니다.\n\n`Ctrl+Shift+I`'
      )),
      makeItem(watchLabel, vscode.TreeItemCollapsibleState.None, {
        command: 'codebreeze.toggleAutoWatch',
        title: 'Toggle Auto-watch',
      }, 'autowatch', watchTooltip),
      makeItem('📊 Monitor', vscode.TreeItemCollapsibleState.Collapsed, undefined, 'monitor',
        new vscode.MarkdownString('**에러/경고 모니터**\n\n현재 워크스페이스의 컴파일 에러와 경고 수를 표시합니다.')
      ),
      makeItem('📋 History', vscode.TreeItemCollapsibleState.Collapsed, undefined, 'history',
        new vscode.MarkdownString('**적용 기록**\n\n최근 코드 적용 기록을 표시합니다. (최대 10개)')
      ),
    ];
  }

  private getMonitorItems(): TreeItem[] {
    const { errors, warnings } = countDiagnostics();
    return [
      makeItem(`Errors: ${errors}  Warnings: ${warnings}`, vscode.TreeItemCollapsibleState.None, {
        command: 'codebreeze.copyErrorsForAI',
        title: 'Copy Errors',
      }, undefined, new vscode.MarkdownString(
        `**현재 진단 현황**\n\n- 에러: ${errors}개\n- 경고: ${warnings}개\n\n클릭하면 에러 컨텍스트를 클립보드에 복사합니다.`
      )),
    ];
  }

  private getHistoryItems(): TreeItem[] {
    const history = getHistory();
    if (history.length === 0) {
      return [makeItem('No history yet', vscode.TreeItemCollapsibleState.None)];
    }

    return history.slice(0, 10).map((entry) => {
      const date = new Date(entry.timestamp).toLocaleTimeString();
      const applied = entry.results.filter((r) => r.status === 'applied').length;
      const label = `${date} — ${applied} file(s) applied`;
      const undoHint = entry.undoAvailable ? '\n\n`Ctrl+Shift+U` 로 되돌리기 가능' : '';
      return makeItem(label, vscode.TreeItemCollapsibleState.None, undefined, 'historyEntry',
        new vscode.MarkdownString(`**적용 기록**\n\n- 시각: ${date}\n- 적용된 파일: ${applied}개${undoHint}`)
      );
    });
  }
}

function makeItem(
  label: string,
  collapsibleState: vscode.TreeItemCollapsibleState,
  command?: vscode.Command,
  contextValue?: string,
  tooltip?: vscode.MarkdownString
): TreeItem {
  return new TreeItem(label, collapsibleState, command, contextValue, tooltip);
}

class TreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    command?: vscode.Command,
    public readonly contextValue?: string,
    tooltip?: vscode.MarkdownString
  ) {
    super(label, collapsibleState);
    this.command = command;
    if (tooltip) {
      this.tooltip = tooltip;
    }
  }
}
