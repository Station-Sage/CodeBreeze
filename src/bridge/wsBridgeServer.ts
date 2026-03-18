/**
 * WebSocket Bridge Server — Phase 4 + Phase 7-3 reliability
 *
 * VS Code extension side of the browser extension bridge.
 * Browser extension connects via WebSocket and sends code blocks
 * detected from AI chat pages (Genspark, ChatGPT, Claude, etc.)
 * directly to VS Code without clipboard copy-paste.
 *
 * Default port: 3701 (configurable via codebreeze.wsBridgePort)
 * Uses the `ws` npm package (RFC 6455 compliant).
 */
import * as http from 'http';
import * as vscode from 'vscode';
import { WebSocketServer, WebSocket } from 'ws';
import { parseClipboard } from '../apply/markdownParser';
import { applyCodeBlocksHeadless } from '../apply/clipboardApply';
import { getConfig } from '../config';
import { updateControlPanel } from '../ui/chatPanel';
import { writeClipboard } from '../utils/clipboardCompat';

// ── Server state ──────────────────────────────────────────────────────────

let bridgeServer: http.Server | undefined;
let wss: WebSocketServer | undefined;
let connections: WebSocket[] = [];
let statusBarItem: vscode.StatusBarItem | undefined;
let bridgeLog: vscode.OutputChannel | undefined;

// ── Retry queue for unacknowledged messages ─────────────────────────────

interface PendingMessage {
  msgId: string;
  data: unknown;
  attempts: number;
  timer: ReturnType<typeof setTimeout>;
}

const pendingMessages = new Map<string, PendingMessage>();
const MAX_RETRY_ATTEMPTS = 3;
const ACK_TIMEOUT_MS = 5000;
let msgIdCounter = 0;

function generateMsgId(): string {
  return `msg-${Date.now()}-${++msgIdCounter}`;
}

// ── Completion response listener (B-014) ────────────────────────────────

type CompletionListener = (text: string) => void;
let completionListener: CompletionListener | null = null;

/** Register a one-shot listener for completion responses from the AI */
export function onceCompletionResponse(listener: CompletionListener): void {
  completionListener = listener;
}

function fireCompletionResponse(text: string): void {
  if (completionListener) {
    const cb = completionListener;
    completionListener = null;
    cb(text);
  }
}

// ── Logging ─────────────────────────────────────────────────────────────

function log(msg: string): void {
  if (!bridgeLog) {
    bridgeLog = vscode.window.createOutputChannel('CodeBreeze Bridge');
  }
  const ts = new Date().toISOString().slice(11, 23);
  bridgeLog.appendLine(`[${ts}] ${msg}`);
}

// ── Public API ────────────────────────────────────────────────────────────

export function getWsBridgePort(): number {
  const cfg = vscode.workspace.getConfiguration('codebreeze');
  return cfg.get<number>('wsBridgePort') ?? 3701;
}

export function isWsBridgeRunning(): boolean {
  return !!bridgeServer;
}

export function getConnectionCount(): number {
  return connections.length;
}

export function getBridgeConnectionState(): 'connected' | 'reconnecting' | 'disconnected' {
  if (!bridgeServer) return 'disconnected';
  return connections.length > 0 ? 'connected' : 'reconnecting';
}

export async function startWsBridge(context: vscode.ExtensionContext): Promise<void> {
  if (bridgeServer) {
    vscode.window.showInformationMessage(
      `CodeBreeze WS bridge already running on port ${getWsBridgePort()}`
    );
    return;
  }

  const port = getWsBridgePort();
  log(`Starting bridge on port ${port}`);

  bridgeServer = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('CodeBreeze WebSocket Bridge');
  });

  wss = new WebSocketServer({ noServer: true });

  bridgeServer.on('upgrade', (req, socket, head) => {
    wss!.handleUpgrade(req, socket as import('net').Socket, head, (ws) => {
      wss!.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws: WebSocket) => {
    connections.push(ws);
    log(`Client connected (total: ${connections.length})`);
    ws.send(JSON.stringify({ type: 'status', watching: true, port }));
    updateBridgeStatusBar();

    ws.on('message', (data) => {
      handleWsMessage(ws, data.toString());
    });

    ws.on('close', () => {
      connections = connections.filter((c) => c !== ws);
      log(`Client disconnected (total: ${connections.length})`);
      updateBridgeStatusBar();
    });

    ws.on('error', (err) => {
      connections = connections.filter((c) => c !== ws);
      log(`Client error: ${err.message}`);
      updateBridgeStatusBar();
    });
  });

  await new Promise<void>((resolve, reject) => {
    bridgeServer!.listen(port, '127.0.0.1', () => resolve());
    bridgeServer!.on('error', reject);
  });

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 89);
  statusBarItem.text = `$(radio-tower) Bridge :${port}`;
  statusBarItem.tooltip = `CodeBreeze Browser Bridge running on ws://127.0.0.1:${port}\nClick to stop`;
  statusBarItem.command = 'codebreeze.stopWsBridge';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  log(`Bridge started on ws://127.0.0.1:${port}`);
  vscode.window
    .showInformationMessage(
      `CodeBreeze: Browser bridge started on ws://127.0.0.1:${port}`,
      'Copy URL'
    )
    .then((choice) => {
      if (choice === 'Copy URL') {
        writeClipboard(`ws://127.0.0.1:${port}`);
      }
    });
}

export function stopWsBridge(): void {
  if (!bridgeServer) {
    vscode.window.showInformationMessage('CodeBreeze: Browser bridge is not running');
    return;
  }
  // Clear pending retry messages
  for (const pending of pendingMessages.values()) {
    clearTimeout(pending.timer);
  }
  pendingMessages.clear();

  connections.forEach((ws) => ws.terminate());
  connections = [];
  wss?.close();
  wss = undefined;
  bridgeServer.close();
  bridgeServer = undefined;
  statusBarItem?.dispose();
  statusBarItem = undefined;
  log('Bridge stopped');
  vscode.window.showInformationMessage('CodeBreeze: Browser bridge stopped');
}

/** Broadcast a message to all connected browser extensions, with optional ACK tracking */
export function broadcastToBrowser(data: Record<string, unknown>, expectAck = false): string | undefined {
  let msgId: string | undefined;
  if (expectAck) {
    msgId = generateMsgId();
    (data as Record<string, unknown>).msgId = msgId;
  }

  const json = JSON.stringify(data);
  log(`→ broadcast: ${data.type}${msgId ? ` (${msgId})` : ''}`);

  connections.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(json);
    }
  });

  if (msgId) {
    scheduleRetry(msgId, data);
  }
  return msgId;
}

function scheduleRetry(msgId: string, data: unknown): void {
  const timer = setTimeout(() => {
    const pending = pendingMessages.get(msgId);
    if (!pending) return;

    if (pending.attempts >= MAX_RETRY_ATTEMPTS) {
      log(`✗ ACK timeout after ${MAX_RETRY_ATTEMPTS} retries: ${msgId}`);
      pendingMessages.delete(msgId);
      return;
    }

    pending.attempts++;
    log(`↻ retry ${pending.attempts}/${MAX_RETRY_ATTEMPTS}: ${msgId}`);
    const json = JSON.stringify(pending.data);
    connections.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(json);
    });
    pending.timer = setTimeout(() => {
      const p = pendingMessages.get(msgId);
      if (p) {
        if (p.attempts >= MAX_RETRY_ATTEMPTS) {
          log(`✗ ACK timeout after ${MAX_RETRY_ATTEMPTS} retries: ${msgId}`);
          pendingMessages.delete(msgId);
        } else {
          scheduleRetry(msgId, data);
        }
      }
    }, ACK_TIMEOUT_MS);
  }, ACK_TIMEOUT_MS);

  pendingMessages.set(msgId, { msgId, data, attempts: 0, timer });
}

function handleAck(msgId: string): void {
  const pending = pendingMessages.get(msgId);
  if (pending) {
    clearTimeout(pending.timer);
    pendingMessages.delete(msgId);
    log(`✓ ACK received: ${msgId}`);
  }
}

function updateBridgeStatusBar(): void {
  if (!statusBarItem) return;
  const count = connections.length;
  const port = getWsBridgePort();
  statusBarItem.text = count > 0
    ? `$(radio-tower) Bridge :${port} (${count})`
    : `$(radio-tower) Bridge :${port}`;
}

// ── Message handler ───────────────────────────────────────────────────────

async function handleWsMessage(ws: WebSocket, raw: string): Promise<void> {
  let msg: Record<string, unknown>;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }

  log(`← ${msg.type as string}${msg.msgId ? ` (${msg.msgId})` : ''}`);

  switch (msg.type) {
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }));
      break;

    case 'ack':
      handleAck(String(msg.msgId));
      break;

    case 'codeBlocks': {
      // Send ACK back if msgId present
      if (msg.msgId) {
        ws.send(JSON.stringify({ type: 'ack', msgId: msg.msgId }));
      }

      const blocks = (msg.blocks as { language?: string; filePath?: string; content: string }[]) || [];
      const source = String(msg.source || 'browser');
      if (blocks.length === 0) return;

      const config = getConfig();
      log(`Received ${blocks.length} code block(s) from ${source}`);

      if (config.autoLevel === 'auto') {
        const cbBlocks = blocks.map((b) => ({
          language: b.language || '',
          filePath: b.filePath || null,
          content: b.content,
          isDiff: false,
        }));
        const results = await applyCodeBlocksHeadless(cbBlocks);
        const applied = results.filter((r) => r.status === 'applied' || r.status === 'created').length;
        ws.send(JSON.stringify({ type: 'applyResult', applied, results }));
        log(`Auto-applied ${applied}/${blocks.length} block(s)`);
        vscode.window.showInformationMessage(
          `CodeBreeze Bridge: ${applied} block(s) applied from ${source}`
        );
      } else {
        const markdown = blocks
          .map((b) => {
            const lang = b.language || '';
            const fp = b.filePath ? `// ${b.filePath}\n` : '';
            return `\`\`\`${lang}\n${fp}${b.content}\n\`\`\``;
          })
          .join('\n\n');

        await writeClipboard(markdown);
        ws.send(JSON.stringify({ type: 'clipboardReady', count: blocks.length }));

        vscode.window
          .showInformationMessage(
            `CodeBreeze Bridge: ${blocks.length} code block(s) from ${source} — ready to apply`,
            'Apply Now'
          )
          .then((choice) => {
            if (choice === 'Apply Now') {
              const cbBlocks = parseClipboard(markdown);
              applyCodeBlocksHeadless(cbBlocks).then((results) => {
                const applied = results.filter(
                  (r) => r.status === 'applied' || r.status === 'created'
                ).length;
                vscode.window.showInformationMessage(`CodeBreeze: ${applied} block(s) applied`);
              });
            }
          });
      }
      break;
    }

    case 'ai_response': {
      // Send ACK back if msgId present
      if (msg.msgId) {
        ws.send(JSON.stringify({ type: 'ack', msgId: msg.msgId }));
      }

      const text = String(msg.payload || '');
      const blocks = parseClipboard(text);
      log(`AI response: ${text.length} chars, ${blocks.length} code block(s)`);

      // B-014: fire completion response for inline completion provider
      if (blocks.length > 0) {
        fireCompletionResponse(blocks[0].content);
      }

      const { isAgentLoopActive, handleAgentLoopResponse } = await import('./agentLoop');
      if (isAgentLoopActive() && blocks.length > 0) {
        handleAgentLoopResponse(blocks);
      }

      if (blocks.length > 0) {
        updateControlPanel(blocks);
      }

      ws.send(JSON.stringify({ type: 'applyResult', applied: blocks.length, results: [] }));
      break;
    }

    case 'send_to_ai': {
      broadcastToBrowser({ type: 'send_to_ai', payload: String(msg.payload || '') });
      break;
    }

    case 'getStatus':
      ws.send(JSON.stringify({ type: 'status', watching: true, port: getWsBridgePort() }));
      break;
  }
}
