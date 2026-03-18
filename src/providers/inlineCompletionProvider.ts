// src/providers/inlineCompletionProvider.ts
// Inline Code Completion Provider — Phase 11-2
// Provides code completions via VS Code InlineCompletionItemProvider.
// Uses bridge (WebSocket → AI chat) or MCP to request completions.
// Design decision D18: Intentional trigger only (not automatic like Copilot).

import * as vscode from 'vscode';
import { getConfig, getWorkspaceRoot } from '../config';
import { buildCompletionContext } from './completionContextBuilder';

let pendingRequest: AbortController | null = null;
let completionCache = new Map<string, { items: vscode.InlineCompletionItem[]; timestamp: number }>();
const CACHE_TTL_MS = 30_000;

export class CodeBreezeInlineCompletionProvider implements vscode.InlineCompletionItemProvider {
  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionItem[] | null> {
    const config = getConfig();
    if (!config.inlineCompletionEnabled) return null;

    // D18: Only trigger on explicit invoke (Ctrl+Space or manual trigger)
    if (context.triggerKind !== vscode.InlineCompletionTriggerKind.Invoke) {
      return null;
    }

    // Cancel any pending request
    if (pendingRequest) {
      pendingRequest.abort();
      pendingRequest = null;
    }

    // Check cache
    const cacheKey = `${document.uri.fsPath}:${position.line}:${position.character}`;
    const cached = completionCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.items;
    }

    if (token.isCancellationRequested) return null;

    try {
      const completionText = await requestCompletion(document, position, token);
      if (!completionText || token.isCancellationRequested) return null;

      const item = new vscode.InlineCompletionItem(
        completionText,
        new vscode.Range(position, position)
      );

      const items = [item];
      completionCache.set(cacheKey, { items, timestamp: Date.now() });

      // Prune old cache entries
      if (completionCache.size > 100) {
        const now = Date.now();
        for (const [key, val] of completionCache) {
          if (now - val.timestamp > CACHE_TTL_MS) completionCache.delete(key);
        }
      }

      return items;
    } catch {
      return null;
    }
  }
}

async function requestCompletion(
  document: vscode.TextDocument,
  position: vscode.Position,
  token: vscode.CancellationToken
): Promise<string | null> {
  const config = getConfig();
  const contextPayload = await buildCompletionContext(document, position);

  if (config.inlineCompletionSource === 'bridge') {
    return requestViaBridge(contextPayload, token);
  } else {
    return requestViaMcp(contextPayload, token);
  }
}

async function requestViaBridge(
  contextPayload: string,
  token: vscode.CancellationToken
): Promise<string | null> {
  try {
    const { isWsBridgeRunning, broadcastToBrowser, onceCompletionResponse } = await import('../bridge/wsBridgeServer');
    if (!isWsBridgeRunning()) return null;

    // Send completion request to browser
    broadcastToBrowser({
      type: 'send_to_ai',
      payload: contextPayload,
      autoSend: true,
    }, true);

    // Wait for AI response via bridge (B-014 fix: actually await response)
    return new Promise<string | null>((resolve) => {
      let settled = false;
      const settle = (value: string | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        disposeCancellation?.dispose();
        resolve(value);
      };

      const timeout = setTimeout(() => settle(null), 15_000);

      const disposeCancellation = token.onCancellationRequested(() => settle(null));
      if (token.isCancellationRequested) { settle(null); return; }

      onceCompletionResponse((text: string) => settle(text || null));
    });
  } catch {
    return null;
  }
}

async function requestViaMcp(
  contextPayload: string,
  _token: vscode.CancellationToken
): Promise<string | null> {
  // MCP completion: store the request for external AI agents to pick up
  try {
    const { isMcpRunning } = await import('../mcp/mcpServer');
    if (!isMcpRunning()) return null;

    // Store pending completion request that MCP clients can retrieve
    setPendingCompletionRequest(contextPayload);

    // MCP is pull-based, so we can't wait for a response here.
    // The completion will be delivered via the apply_code tool call.
    return null;
  } catch {
    return null;
  }
}

// ── Pending completion request store (for MCP clients) ──

let pendingCompletionRequestPayload: string | null = null;

export function setPendingCompletionRequest(payload: string): void {
  pendingCompletionRequestPayload = payload;
}

export function getPendingCompletionRequest(): string | null {
  const payload = pendingCompletionRequestPayload;
  pendingCompletionRequestPayload = null;
  return payload;
}

export function clearCompletionCache(): void {
  completionCache.clear();
}

/**
 * Manual completion trigger command.
 * Builds context and sends to AI via bridge, then user applies the response.
 */
export async function triggerInlineCompletion(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage('CodeBreeze: No active editor');
    return;
  }

  const config = getConfig();
  const contextPayload = await buildCompletionContext(editor.document, editor.selection.active);

  if (config.inlineCompletionSource === 'bridge') {
    try {
      const { isWsBridgeRunning, broadcastToBrowser } = await import('../bridge/wsBridgeServer');
      if (!isWsBridgeRunning()) {
        vscode.window.showWarningMessage('CodeBreeze: Bridge not running. Start it first.');
        return;
      }
      broadcastToBrowser({
        type: 'send_to_ai',
        payload: contextPayload,
        autoSend: true,
      }, true);
      vscode.window.showInformationMessage('CodeBreeze: Completion request sent to AI');
    } catch {
      vscode.window.showErrorMessage('CodeBreeze: Failed to send completion request');
    }
  } else {
    // Copy to clipboard for manual paste
    const { writeClipboard } = await import('../utils/clipboardCompat');
    await writeClipboard(contextPayload);
    vscode.window.showInformationMessage('CodeBreeze: Completion context copied to clipboard');
  }
}
