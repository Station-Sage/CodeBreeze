/**
 * Agent Loop — Phase 5 + Phase 9 (multi-phase, auto-apply, progress UI)
 *
 * Automated build → error → AI fix cycle with:
 * - Phase-aware loop (Analyze → Request → Waiting → Apply → Verify)
 * - 3 auto-apply modes: preview / auto / safe
 * - Iteration history to prevent repeated mistakes
 * - Real-time progress UI updates
 */
import * as vscode from 'vscode';
import { applyCodeBlocksHeadless } from '../apply/clipboardApply';
import { applyInlineDiffHeadless } from '../apply/inlineDiffApply';
import { buildContextPayload } from '../collect/smartContext';
import { getErrorChainFiles } from '../collect/errorChainCollector';
import { getConfig, getWorkspaceRoot } from '../config';
import { countDiagnostics } from '../monitor/diagnosticsMonitor';
import { CodeBlock } from '../types';
import { AgentLoopPhase, DEFAULT_AGENT_LOOP_MAX_ITERATIONS } from './bridgeProtocol';
import {
  buildErrorFixPrompt,
  buildIterationPrompt,
  buildErrorChainMarkdown,
  summarizeErrors,
  IterationRecord,
} from './promptBuilder';

interface AgentLoopState {
  active: boolean;
  iteration: number;
  maxIterations: number;
  phase: AgentLoopPhase;
  webview: vscode.Webview | null;
  resolveResponse: ((blocks: CodeBlock[]) => void) | null;
  abortRequested: boolean;
  startTime: number;
  history: IterationRecord[];
}

const state: AgentLoopState = {
  active: false,
  iteration: 0,
  maxIterations: 0,
  phase: 'complete',
  webview: null,
  resolveResponse: null,
  abortRequested: false,
  startTime: 0,
  history: [],
};

export function isAgentLoopActive(): boolean {
  return state.active;
}

/** content.js가 AI 응답을 감지하면 wsBridgeServer가 이 함수를 호출 */
export function handleAgentLoopResponse(blocks: CodeBlock[]): void {
  if (state.resolveResponse && blocks.length > 0) {
    state.resolveResponse(blocks);
    state.resolveResponse = null;
  }
}

/** AI 응답 대기 (configurable timeout) */
function waitForAIResponse(timeoutMs: number): Promise<CodeBlock[]> {
  return new Promise((resolve, reject) => {
    state.resolveResponse = resolve;
    setTimeout(() => {
      if (state.resolveResponse) {
        state.resolveResponse = null;
        reject(new Error('AI response timeout'));
      }
    }, timeoutMs);
  });
}

// ── Progress notification helpers ────────────────────────────────────────

function setPhase(phase: AgentLoopPhase): void {
  state.phase = phase;
  notifyProgress();
}

function notify(text: string): void {
  state.webview?.postMessage({ command: 'agentLoopUpdate', text });
}

function notifyProgress(): void {
  const elapsed = Math.round((Date.now() - state.startTime) / 1000);
  state.webview?.postMessage({
    command: 'agentLoopProgress',
    iteration: state.iteration,
    maxIterations: state.maxIterations,
    phase: state.phase,
    elapsedSeconds: elapsed,
    historyCount: state.history.length,
  });
}

function collectErrorFingerprint(): string {
  const allDiags = vscode.languages.getDiagnostics();
  const items: string[] = [];
  for (const [uri, diagnostics] of allDiags) {
    for (const d of diagnostics) {
      if (d.severity === vscode.DiagnosticSeverity.Error) {
        items.push(`${uri.fsPath}:${d.range.start.line}:${d.message.slice(0, 80)}`);
      }
    }
  }
  items.sort();
  return items.join('|');
}

function getErrorFilePaths(): string[] {
  const allDiags = vscode.languages.getDiagnostics();
  const files = new Set<string>();
  for (const [uri, diagnostics] of allDiags) {
    if (diagnostics.some((d) => d.severity === vscode.DiagnosticSeverity.Error)) {
      files.add(uri.fsPath);
    }
  }
  return [...files];
}

function getErrorDiagnosticItems(): Array<{ file: string; message: string }> {
  const allDiags = vscode.languages.getDiagnostics();
  const items: Array<{ file: string; message: string }> = [];
  for (const [uri, diagnostics] of allDiags) {
    for (const d of diagnostics) {
      if (d.severity === vscode.DiagnosticSeverity.Error) {
        items.push({ file: uri.fsPath, message: d.message });
      }
    }
  }
  return items;
}

// ── Main Agent Loop ──────────────────────────────────────────────────────

export async function startAgentLoop(webview: vscode.Webview): Promise<void> {
  if (state.active) {
    vscode.window.showWarningMessage('CodeBreeze: Agent loop already running');
    return;
  }

  const { isWsBridgeRunning, broadcastToBrowser } = await import('./wsBridgeServer');
  if (!isWsBridgeRunning()) {
    vscode.window.showWarningMessage('CodeBreeze: Start browser bridge first');
    return;
  }

  state.active = true;
  state.iteration = 0;
  state.webview = webview;
  state.abortRequested = false;
  state.startTime = Date.now();
  state.history = [];

  const vsCfg = vscode.workspace.getConfiguration('codebreeze');
  const maxIterations =
    vsCfg.get<number>('agentLoopMaxIterations') ?? DEFAULT_AGENT_LOOP_MAX_ITERATIONS;
  const timeoutSec = vsCfg.get<number>('agentLoopTimeout') ?? 300;
  const applyMode = vsCfg.get<string>('applyMode') ?? 'inline';
  const errorChainDepth = vsCfg.get<number>('errorChainDepth') ?? 2;
  const config = getConfig();
  const workspaceRoot = getWorkspaceRoot() || '';
  const autoApplyMode = config.agentLoopAutoApply;

  state.maxIterations = maxIterations;
  notify(
    `Agent loop started (max ${maxIterations} iterations, timeout ${timeoutSec}s, apply: ${autoApplyMode})`
  );

  let lastFingerprint = '';
  let repeatedCount = 0;

  try {
    for (let i = 0; i < maxIterations; i++) {
      if (state.abortRequested) {
        notify('Agent loop aborted by user');
        break;
      }

      state.iteration = i + 1;
      notify(`--- Iteration ${state.iteration}/${maxIterations} ---`);

      // ── Phase 1: Analyze ──
      setPhase('analyze');
      notify('Analyzing: Running build...');
      const { runCommandAndCopy } = await import('../collect/localBuildCollector');
      const buildCmd = config.buildCommands[0] || 'npm run build';
      const buildResult = await runCommandAndCopy(buildCmd);

      const { errors } = countDiagnostics();
      const buildFailed = buildResult && buildResult.exitCode !== 0;

      if (errors === 0 && !buildFailed) {
        // Run tests if configured
        const testCmd = config.testCommands[0];
        if (testCmd) {
          notify('Build OK. Running tests...');
          const testResult = await runCommandAndCopy(testCmd);
          const { errors: testErrors } = countDiagnostics();
          if (testErrors === 0 && testResult && testResult.exitCode === 0) {
            setPhase('complete');
            notify('Build and tests passed! Agent loop complete.');
            break;
          }
          notify(`Tests failed (exit ${testResult?.exitCode}). Collecting context...`);
        } else {
          setPhase('complete');
          notify('Build succeeded with no errors! Agent loop complete.');
          break;
        }
      } else {
        notify(`${errors} error(s) detected. Collecting context...`);
      }

      // Check for repeated errors (early termination)
      const currentFingerprint = collectErrorFingerprint();
      if (currentFingerprint === lastFingerprint && currentFingerprint !== '') {
        repeatedCount++;
        if (repeatedCount >= 2) {
          notify('Same errors repeated 2 times. Stopping loop — manual fix needed.');
          break;
        }
        notify(`Warning: Same errors as last iteration (repeat ${repeatedCount}/2)`);
      } else {
        repeatedCount = 0;
      }
      lastFingerprint = currentFingerprint;

      // ── Phase 2: Request ──
      setPhase('request');
      const contextPayload = await buildContextPayload(['errors', 'file', 'buildLog']);
      const errorFiles = getErrorFilePaths();
      const chainContext = buildErrorChainMarkdown(
        errorFiles,
        workspaceRoot,
        errorChainDepth,
        getErrorChainFiles
      );

      let prompt: string;
      if (state.history.length === 0) {
        prompt = buildErrorFixPrompt(errors, contextPayload, chainContext);
      } else {
        prompt = buildIterationPrompt(errors, contextPayload, chainContext, state.history);
      }

      // ── Phase 3: Waiting ──
      setPhase('waiting');
      notify('Sending error context to AI...');
      broadcastToBrowser({ type: 'send_to_ai', payload: prompt, autoSend: true }, true);

      notify('Waiting for AI response...');
      let responseBlocks: CodeBlock[];
      try {
        responseBlocks = await waitForAIResponse(timeoutSec * 1000);
      } catch {
        notify('AI response timeout. Stopping loop.');
        break;
      }

      if (state.abortRequested) {
        notify('Agent loop aborted by user');
        break;
      }

      // ── Phase 4: Apply ──
      setPhase('apply');
      notify(
        `Received ${responseBlocks.length} code block(s). Applying (mode: ${autoApplyMode})...`
      );

      let results;
      if (autoApplyMode === 'preview') {
        // Show native diff preview for each block
        const { showNativeDiff } = await import('../apply/nativeDiffPreview');
        const accepted: CodeBlock[] = [];
        for (const block of responseBlocks) {
          if (block.filePath) {
            const wasAccepted = await showNativeDiff(block);
            if (wasAccepted) accepted.push(block);
          } else {
            accepted.push(block);
          }
        }
        results =
          applyMode === 'inline'
            ? await applyInlineDiffHeadless(accepted)
            : await applyCodeBlocksHeadless(accepted);
      } else {
        // auto or safe: apply directly
        results =
          applyMode === 'inline'
            ? await applyInlineDiffHeadless(responseBlocks)
            : await applyCodeBlocksHeadless(responseBlocks);
      }

      const applied = results.filter(
        (r) => r.status === 'applied' || r.status === 'created'
      ).length;
      const appliedFiles = results
        .filter((r) => r.status === 'applied' || r.status === 'created')
        .map((r) => r.filePath);
      notify(`Applied ${applied}/${responseBlocks.length} block(s)`);

      // ── Phase 5: Verify ──
      setPhase('verify');
      // Wait for diagnostics update
      await new Promise((r) => setTimeout(r, 2000));

      // Record iteration history
      const { errors: postErrors } = countDiagnostics();
      const errorItems = getErrorDiagnosticItems();
      state.history.push({
        iteration: state.iteration,
        errorSummary: summarizeErrors(errorItems),
        appliedFiles,
        buildExitCode: buildResult?.exitCode ?? -1,
        errorCount: postErrors,
      });

      // Safe mode: verify build+test, undo if failed
      if (autoApplyMode === 'safe' && applied > 0) {
        notify('Safe mode: Verifying build+test after apply...');
        const verifyResult = await runCommandAndCopy(buildCmd);
        const { errors: verifyErrors } = countDiagnostics();

        if (
          verifyErrors > errors ||
          (verifyResult && verifyResult.exitCode !== 0 && !buildFailed)
        ) {
          notify('Safe mode: Changes made things worse. Undoing...');
          try {
            const { undoLastApply } = await import('../apply/safetyGuard');
            await undoLastApply();
            notify('Changes reverted. Trying different approach in next iteration.');
          } catch (undoErr) {
            notify(`Undo failed: ${undoErr instanceof Error ? undoErr.message : String(undoErr)}`);
          }
        }
      }
    }
  } catch (err) {
    notify(`Agent loop error: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    state.active = false;
    state.resolveResponse = null;
    state.abortRequested = false;
    setPhase('complete');
    notify('Agent loop finished');
  }
}

export function stopAgentLoop(): void {
  if (state.active) {
    state.abortRequested = true;
    // B-015: reject the pending Promise instead of leaving it dangling
    if (state.resolveResponse) {
      state.resolveResponse([]);
      state.resolveResponse = null;
    }
    notify('Agent loop stop requested...');
  }
}
