// src/bridge/agentLoop.ts

import * as vscode from 'vscode';
import { applyCodeBlocksHeadless } from '../apply/clipboardApply';
import { applyInlineDiffHeadless } from '../apply/inlineDiffApply';
import { buildContextPayload } from '../collect/smartContext';
import { getErrorChainFiles } from '../collect/errorChainCollector';
import { getConfig, getWorkspaceRoot } from '../config';
import { countDiagnostics } from '../monitor/diagnosticsMonitor';
import { CodeBlock } from '../types';
import { DEFAULT_AGENT_LOOP_MAX_ITERATIONS } from './bridgeProtocol';
import { formatCodeBlock } from '../utils/markdown';
import * as fs from 'fs';
import * as path from 'path';

interface AgentLoopState {
  active: boolean;
  iteration: number;
  webview: vscode.Webview | null;
  resolveResponse: ((blocks: CodeBlock[]) => void) | null;
  abortRequested: boolean;
}

const state: AgentLoopState = {
  active: false,
  iteration: 0,
  webview: null,
  resolveResponse: null,
  abortRequested: false,
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

function notify(text: string): void {
  state.webview?.postMessage({ command: 'agentLoopUpdate', text });
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

/**
 * Collect error file paths from VS Code diagnostics.
 */
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

/**
 * Build error chain context markdown.
 */
function buildErrorChainContext(workspaceRoot: string, depth: number): string {
  const errorFiles = getErrorFilePaths();
  if (errorFiles.length === 0) return '';

  const chains = getErrorChainFiles(errorFiles, workspaceRoot, depth);
  const parts: string[] = ['### Related Files (import chain)'];

  for (const chain of chains) {
    for (const chainFile of chain.chainFiles.slice(0, 5)) {
      try {
        const content = fs.readFileSync(chainFile, 'utf8');
        const relPath = path.relative(workspaceRoot, chainFile);
        const ext = path.extname(chainFile).slice(1);
        // Truncate to 50 lines for context
        const lines = content.split('\n');
        const truncated = lines.length > 50 ? lines.slice(0, 50).join('\n') + '\n// ...' : content;
        parts.push(formatCodeBlock(truncated, ext, relPath));
      } catch {
        // skip unreadable files
      }
    }
  }

  return parts.length > 1 ? parts.join('\n\n') : '';
}

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

  const vsCfg = vscode.workspace.getConfiguration('codebreeze');
  const maxIterations = vsCfg.get<number>('agentLoopMaxIterations') ?? DEFAULT_AGENT_LOOP_MAX_ITERATIONS;
  const timeoutSec = vsCfg.get<number>('agentLoopTimeout') ?? 300;
  const applyMode = vsCfg.get<string>('applyMode') ?? 'inline';
  const errorChainDepth = vsCfg.get<number>('errorChainDepth') ?? 2;
  const config = getConfig();
  const workspaceRoot = getWorkspaceRoot() || '';

  notify(`Agent loop started (max ${maxIterations} iterations, timeout ${timeoutSec}s)`);

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

      // Step 1: Build
      notify('Running build...');
      const { runCommandAndCopy } = await import('../collect/localBuildCollector');
      const buildCmd = config.buildCommands[0] || 'npm run build';
      const buildResult = await runCommandAndCopy(buildCmd);

      // Step 2: Check errors
      const { errors } = countDiagnostics();
      const buildFailed = buildResult && buildResult.exitCode !== 0;

      if (errors === 0 && !buildFailed) {
        // Step 2b: Run test command if configured
        const testCmd = config.testCommands[0];
        if (testCmd) {
          notify('Build OK. Running tests...');
          const testResult = await runCommandAndCopy(testCmd);
          const { errors: testErrors } = countDiagnostics();
          if (testErrors === 0 && testResult && testResult.exitCode === 0) {
            notify('Build and tests passed! Agent loop complete.');
            break;
          }
          notify(`Tests failed (exit ${testResult?.exitCode}). Collecting context...`);
        } else {
          notify('Build succeeded with no errors! Agent loop complete.');
          break;
        }
      } else {
        notify(`${errors} error(s) detected. Collecting context...`);
      }

      // Step 3: Check for repeated errors (early termination)
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

      // Step 4: Collect error context + import chain
      const contextPayload = await buildContextPayload(['errors', 'file', 'buildLog']);
      const chainContext = buildErrorChainContext(workspaceRoot, errorChainDepth);
      const prompt = [
        `The build/test failed with ${errors} error(s). Please fix the following issues:`,
        '',
        contextPayload,
        chainContext,
      ].filter(Boolean).join('\n\n');

      // Step 5: Send to AI
      notify('Sending error context to AI...');
      broadcastToBrowser({ type: 'send_to_ai', payload: prompt, autoSend: true });

      // Step 6: Wait for AI response
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

      // Step 7: Apply code blocks
      notify(`Applying ${responseBlocks.length} code block(s) (mode: ${applyMode})...`);
      const results = applyMode === 'inline'
        ? await applyInlineDiffHeadless(responseBlocks)
        : await applyCodeBlocksHeadless(responseBlocks);
      const applied = results.filter((r) => r.status === 'applied' || r.status === 'created').length;
      notify(`Applied ${applied}/${responseBlocks.length} block(s)`);

      // Wait for diagnostics update
      await new Promise((r) => setTimeout(r, 2000));
    }
  } catch (err) {
    notify(`Agent loop error: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    state.active = false;
    state.resolveResponse = null;
    state.abortRequested = false;
    notify('Agent loop finished');
  }
}

export function stopAgentLoop(): void {
  if (state.active) {
    state.abortRequested = true;
    state.resolveResponse = null;
    notify('Agent loop stop requested...');
  }
}
