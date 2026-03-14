import * as vscode from 'vscode';
import { getConfig } from '../config';

type DiagnosticsChangedCallback = (errorCount: number, warningCount: number) => void;

const listeners: DiagnosticsChangedCallback[] = [];
let lastErrorCount = 0;

export function onDiagnosticsChanged(cb: DiagnosticsChangedCallback): vscode.Disposable {
  listeners.push(cb);
  return {
    dispose: () => {
      const idx = listeners.indexOf(cb);
      if (idx >= 0) listeners.splice(idx, 1);
    },
  };
}

export function registerDiagnosticsMonitor(context: vscode.ExtensionContext): void {
  const sub = vscode.languages.onDidChangeDiagnostics(() => {
    const config = getConfig();
    if (config.autoLevel === 'off') return;

    const { errors, warnings } = countDiagnostics();
    listeners.forEach((cb) => cb(errors, warnings));

    // Notify only when new errors appear
    if (errors > lastErrorCount) {
      const newErrors = errors - lastErrorCount;
      vscode.window
        .showWarningMessage(`CodeBreeze: ${newErrors} new error(s) detected`, 'Copy Errors')
        .then((choice) => {
          if (choice === 'Copy Errors') {
            vscode.commands.executeCommand('codebreeze.copyErrorsForAI');
          }
        });
    }
    lastErrorCount = errors;
  });

  context.subscriptions.push(sub);
}

export function countDiagnostics(): { errors: number; warnings: number } {
  let errors = 0;
  let warnings = 0;
  for (const [, diags] of vscode.languages.getDiagnostics()) {
    for (const d of diags) {
      if (d.severity === vscode.DiagnosticSeverity.Error) errors++;
      if (d.severity === vscode.DiagnosticSeverity.Warning) warnings++;
    }
  }
  return { errors, warnings };
}
