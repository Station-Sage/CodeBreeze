// src/bridge/backgroundAgent.ts
// Background Agent — Phase 11-1
// Monitors diagnostics and auto-triggers agent loop when errors appear.
// Runs passively in the background without blocking the UI.

import * as vscode from 'vscode';
import { countDiagnostics } from '../monitor/diagnosticsMonitor';
import { getConfig, getWorkspaceRoot } from '../config';

export type BackgroundAgentStatus = 'idle' | 'watching' | 'triggered' | 'running' | 'cooldown';

interface BackgroundAgentState {
  enabled: boolean;
  status: BackgroundAgentStatus;
  lastTriggerTime: number;
  errorCountAtTrigger: number;
  consecutiveRuns: number;
  statusBarItem: vscode.StatusBarItem | null;
  diagnosticsDisposable: vscode.Disposable | null;
  cooldownTimer: ReturnType<typeof setTimeout> | null;
}

const state: BackgroundAgentState = {
  enabled: false,
  status: 'idle',
  lastTriggerTime: 0,
  errorCountAtTrigger: 0,
  consecutiveRuns: 0,
  statusBarItem: null,
  diagnosticsDisposable: null,
  cooldownTimer: null,
};

const MAX_CONSECUTIVE_RUNS = 3;
const MIN_TRIGGER_INTERVAL_MS = 30_000; // 30s minimum between triggers
const COOLDOWN_MS = 60_000; // 60s cooldown after max consecutive runs
const DEBOUNCE_MS = 5_000; // 5s debounce after error detection

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function isBackgroundAgentEnabled(): boolean {
  return state.enabled;
}

export function getBackgroundAgentStatus(): BackgroundAgentStatus {
  return state.status;
}

function setStatus(status: BackgroundAgentStatus): void {
  state.status = status;
  updateStatusBar();
}

function updateStatusBar(): void {
  if (!state.statusBarItem) return;

  const icons: Record<BackgroundAgentStatus, string> = {
    idle: '$(circle-outline)',
    watching: '$(eye)',
    triggered: '$(zap)',
    running: '$(sync~spin)',
    cooldown: '$(clock)',
  };

  const labels: Record<BackgroundAgentStatus, string> = {
    idle: 'BG Agent: Off',
    watching: 'BG Agent: Watching',
    triggered: 'BG Agent: Triggered',
    running: 'BG Agent: Running',
    cooldown: 'BG Agent: Cooldown',
  };

  state.statusBarItem.text = `${icons[state.status]} ${labels[state.status]}`;
  state.statusBarItem.tooltip = getStatusTooltip();
  state.statusBarItem.show();
}

function getStatusTooltip(): string {
  const lines = [`Background Agent: ${state.status}`];
  if (state.consecutiveRuns > 0) {
    lines.push(`Consecutive runs: ${state.consecutiveRuns}/${MAX_CONSECUTIVE_RUNS}`);
  }
  if (state.lastTriggerTime > 0) {
    const ago = Math.round((Date.now() - state.lastTriggerTime) / 1000);
    lines.push(`Last trigger: ${ago}s ago`);
  }
  lines.push('Click to toggle');
  return lines.join('\n');
}

async function onDiagnosticsChange(): Promise<void> {
  if (!state.enabled || state.status === 'running' || state.status === 'cooldown') return;

  const { errors } = countDiagnostics();
  if (errors === 0) {
    if (state.status === 'triggered') setStatus('watching');
    state.consecutiveRuns = 0;
    return;
  }

  // Debounce: wait for errors to stabilize
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => tryTriggerAgentLoop(), DEBOUNCE_MS);
}

async function tryTriggerAgentLoop(): Promise<void> {
  if (!state.enabled || state.status === 'running' || state.status === 'cooldown') return;

  const { errors } = countDiagnostics();
  if (errors === 0) return;

  // Respect minimum trigger interval
  const elapsed = Date.now() - state.lastTriggerTime;
  if (elapsed < MIN_TRIGGER_INTERVAL_MS) return;

  // Check consecutive run limit
  if (state.consecutiveRuns >= MAX_CONSECUTIVE_RUNS) {
    setStatus('cooldown');
    vscode.window.showWarningMessage(
      `CodeBreeze: Background agent paused after ${MAX_CONSECUTIVE_RUNS} consecutive runs. Resuming in 60s.`
    );
    state.cooldownTimer = setTimeout(() => {
      state.consecutiveRuns = 0;
      if (state.enabled) setStatus('watching');
    }, COOLDOWN_MS);
    return;
  }

  // Check if bridge is available
  const config = getConfig();
  if (config.backgroundAgentMode === 'bridge') {
    try {
      const { isWsBridgeRunning } = await import('./wsBridgeServer');
      if (!isWsBridgeRunning()) return; // Bridge not running, skip
    } catch {
      return;
    }
  }

  // Trigger agent loop
  setStatus('triggered');
  state.lastTriggerTime = Date.now();
  state.errorCountAtTrigger = errors;
  state.consecutiveRuns++;

  const choice = config.backgroundAgentTrigger;
  if (choice === 'notify') {
    const action = await vscode.window.showWarningMessage(
      `CodeBreeze: ${errors} error(s) detected. Run Agent Loop?`,
      'Run Agent Loop',
      'Dismiss'
    );
    if (action !== 'Run Agent Loop') {
      setStatus('watching');
      return;
    }
  }

  // Auto or user-confirmed: run the loop
  setStatus('running');
  try {
    const { isAgentLoopActive, startAgentLoop } = await import('./agentLoop');
    if (isAgentLoopActive()) {
      setStatus('watching');
      return;
    }

    // Create a minimal webview proxy for background notifications
    const outputChannel = vscode.window.createOutputChannel('CodeBreeze Background Agent');
    const proxyWebview = createBackgroundWebviewProxy(outputChannel);
    await startAgentLoop(proxyWebview);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`CodeBreeze: Background agent error: ${msg}`);
  } finally {
    if (state.enabled) {
      setStatus('watching');
    } else {
      setStatus('idle');
    }
  }
}

/**
 * Creates a minimal webview-like proxy that forwards agent loop messages
 * to an OutputChannel instead of a real webview panel.
 */
function createBackgroundWebviewProxy(outputChannel: vscode.OutputChannel): vscode.Webview {
  return {
    postMessage: (message: unknown) => {
      const msg = message as Record<string, unknown>;
      if (msg.command === 'agentLoopUpdate' && msg.text) {
        outputChannel.appendLine(`[BG Agent] ${msg.text}`);
      }
      if (msg.command === 'agentLoopProgress') {
        const phase = msg.phase as string;
        const iter = msg.iteration as number;
        const max = msg.maxIterations as number;
        outputChannel.appendLine(`[BG Agent] Phase: ${phase} (${iter}/${max})`);
      }
      return Promise.resolve(true);
    },
    html: '',
    options: {},
    cspSource: '',
    onDidReceiveMessage: new vscode.EventEmitter<unknown>().event,
    asWebviewUri: (uri: vscode.Uri) => uri,
  } as unknown as vscode.Webview;
}

export function startBackgroundAgent(context: vscode.ExtensionContext): void {
  if (state.enabled) return;

  state.enabled = true;

  // Create status bar
  if (!state.statusBarItem) {
    state.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 80);
    state.statusBarItem.command = 'codebreeze.toggleBackgroundAgent';
    context.subscriptions.push(state.statusBarItem);
  }

  // Listen for diagnostics changes
  state.diagnosticsDisposable = vscode.languages.onDidChangeDiagnostics(() => {
    onDiagnosticsChange();
  });
  context.subscriptions.push(state.diagnosticsDisposable);

  setStatus('watching');
  vscode.window.showInformationMessage('CodeBreeze: Background agent started');
}

export function stopBackgroundAgent(): void {
  if (!state.enabled) return;

  state.enabled = false;
  state.diagnosticsDisposable?.dispose();
  state.diagnosticsDisposable = null;

  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (state.cooldownTimer) {
    clearTimeout(state.cooldownTimer);
    state.cooldownTimer = null;
  }

  setStatus('idle');
  vscode.window.showInformationMessage('CodeBreeze: Background agent stopped');
}

export function toggleBackgroundAgent(context: vscode.ExtensionContext): void {
  if (state.enabled) {
    stopBackgroundAgent();
  } else {
    startBackgroundAgent(context);
  }
}
