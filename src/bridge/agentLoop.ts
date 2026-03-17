// src/bridge/agentLoop.ts

import * as vscode from 'vscode';
import { applyCodeBlocksHeadless } from '../apply/clipboardApply';
import { buildContextPayload } from '../collect/smartContext';
import { getConfig } from '../config';
import { countDiagnostics } from '../monitor/diagnosticsMonitor';
import { CodeBlock } from '../types';
import { DEFAULT_AGENT_LOOP_MAX_ITERATIONS } from './bridgeProtocol';

interface AgentLoopState {
  active: boolean;
  iteration: number;
  webview: vscode.Webview | null;
  resolveResponse: ((blocks: CodeBlock[]) => void) | null;
}

const state: AgentLoopState = {
  active: false,
  iteration: 0,
  webview: null,
  resolveResponse: null,
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

/** AI 응답 대기 (타임아웃: 120초) */
function waitForAIResponse(timeoutMs = 120_000): Promise<CodeBlock[]> {
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

  const cfg = vscode.workspace.getConfiguration('codebreeze');
  const maxIterations = cfg.get<number>('agentLoopMaxIterations') ?? DEFAULT_AGENT_LOOP_MAX_ITERATIONS;

  notify(`🔄 Agent loop started (max ${maxIterations} iterations)`);

  try {
    for (let i = 0; i < maxIterations; i++) {
      state.iteration = i + 1;
      notify(`--- Iteration ${state.iteration}/${maxIterations} ---`);

      // Step 1: 빌드 실행
      notify('🔨 Running build...');
      const { runCommandAndCopy } = await import('../collect/localBuildCollector');
      const config = getConfig();
      const buildCmd = config.buildCommands[0] || 'npm run build';
      const buildResult = await runCommandAndCopy(buildCmd);

      // Step 2: 에러 확인
      const { errors } = countDiagnostics();
      const buildFailed = buildResult && buildResult.exitCode !== 0;

      if (errors === 0 && !buildFailed) {
        notify('✅ Build succeeded with no errors! Agent loop complete.');
        break;
      }

      notify(`⚠️ ${errors} error(s) detected. Collecting context...`);

      // Step 3: 에러 컨텍스트 수집
      const contextPayload = await buildContextPayload(['errors', 'file', 'buildLog']);
      const prompt = `The build failed with ${errors} error(s). Please fix the following issues:\n\n${contextPayload}`;

      // Step 4: AI챗으로 전송
      notify('📤 Sending error context to AI...');
      broadcastToBrowser({ type: 'send_to_ai', payload: prompt, autoSend: true });

      // Step 5: AI 응답 대기
      notify('⏳ Waiting for AI response...');
      let responseBlocks: CodeBlock[];
      try {
        responseBlocks = await waitForAIResponse();
      } catch {
        notify('⏰ AI response timeout. Stopping loop.');
        break;
      }

      // Step 6: 코드 적용
      notify(`📥 Applying ${responseBlocks.length} code block(s)...`);
      const results = await applyCodeBlocksHeadless(responseBlocks);
      const applied = results.filter((r) => r.status === 'applied' || r.status === 'created').length;
      notify(`✅ Applied ${applied}/${responseBlocks.length} block(s)`);

      // 짧은 대기 (diagnostics 업데이트 시간)
      await new Promise((r) => setTimeout(r, 2000));
    }
  } catch (err) {
    notify(`❌ Agent loop error: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    state.active = false;
    state.resolveResponse = null;
    notify('🏁 Agent loop finished');
  }
}

export function stopAgentLoop(): void {
  if (state.active) {
    state.active = false;
    state.resolveResponse = null;
    notify('🛑 Agent loop stopped by user');
  }
}
