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

let lastErrorNotifyTime = 0;

export function registerTerminalMonitor(context: vscode.ExtensionContext): void {
  // onDidEndTerminalShellExecution: 정식 API (VS Code 1.93+)
  // 터미널 명령 실행 완료 시 exit code 기반 에러 감지
  if (!('onDidEndTerminalShellExecution' in vscode.window)) return;

  const execSub = vscode.window.onDidEndTerminalShellExecution((e) => {
    const exitCode = e.exitCode;
    if (exitCode === undefined || exitCode === 0) return;

    const config = getConfig();
    if (config.autoLevel === 'off') return;
    if (Date.now() - lastErrorNotifyTime < 3000) return;

    lastErrorNotifyTime = Date.now();

    const msg = `Terminal: command exited with code ${exitCode}`;

    if (config.autoLevel === 'notify') {
      vscode.window.showWarningMessage(`CodeBreeze: ${msg}`);
    } else if (config.autoLevel === 'auto') {
      vscode.commands.executeCommand('codebreeze._terminalError', msg);
    }
  });

  // 에러 패턴 감지: shell integration output (VS Code 1.93+)
  const startSub = vscode.window.onDidStartTerminalShellExecution?.((e) => {
    const stream = e.execution.read();
    (async () => {
      for await (const chunk of stream) {
        if (ERROR_PATTERNS.some((p) => p.test(chunk))) {
          const config = getConfig();
          if (config.autoLevel === 'off') continue;
          if (Date.now() - lastErrorNotifyTime < 3000) continue;
          lastErrorNotifyTime = Date.now();
          if (config.autoLevel === 'auto') {
            vscode.commands.executeCommand('codebreeze._terminalError', chunk.substring(0, 500));
          }
        }
      }
    })();
  });

  context.subscriptions.push(execSub);
  if (startSub) context.subscriptions.push(startSub);
}

export function getTerminalOutput(): string {
  // Shell integration 기반으로 변경 후 버퍼 방식 제거
  // 실시간 출력은 onDidStartTerminalShellExecution stream에서 처리
  return '';
}
