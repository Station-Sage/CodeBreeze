import * as vscode from 'vscode';
import { getConfig } from '../config';
import { MonitorEvent } from '../types';

type EventCallback = (event: MonitorEvent) => void;

const listeners: EventCallback[] = [];

export function onMonitorEvent(callback: EventCallback): vscode.Disposable {
  listeners.push(callback);
  return {
    dispose: () => {
      const idx = listeners.indexOf(callback);
      if (idx >= 0) listeners.splice(idx, 1);
    },
  };
}

function emit(event: MonitorEvent): void {
  const config = getConfig();
  if (config.autoLevel === 'off') return;
  listeners.forEach((cb) => cb(event));
}

export function registerTaskMonitor(context: vscode.ExtensionContext): void {
  const startSub = vscode.tasks.onDidStartTask((e) => {
    emit({
      source: 'task',
      type: 'build_start',
      data: { taskName: e.execution.task.name },
      timestamp: Date.now(),
    });
  });

  const endSub = vscode.tasks.onDidEndTaskProcess((e) => {
    const config = getConfig();
    const failed = (e.exitCode ?? 0) !== 0;
    const type = e.execution.task.name.toLowerCase().includes('test') ? 'test_end' : 'build_end';

    emit({
      source: 'task',
      type,
      data: {
        taskName: e.execution.task.name,
        exitCode: e.exitCode,
        failed,
      },
      timestamp: Date.now(),
    });

    if (failed && config.autoLevel !== 'off') {
      vscode.window
        .showWarningMessage(
          `CodeBreeze: "${e.execution.task.name}" failed (exit ${e.exitCode})`,
          'Open Control Panel'
        )
        .then((choice) => {
          if (choice === 'Open Control Panel') {
            vscode.commands.executeCommand('codebreeze.openControlPanel');
          }
        });
    }
  });

  context.subscriptions.push(startSub, endSub);
}
