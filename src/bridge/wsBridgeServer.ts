/**
 * WebSocket Bridge Server — Phase 4
 *
 * VS Code extension side of the browser extension bridge.
 * Browser extension connects via WebSocket and sends code blocks
 * detected from AI chat pages (Genspark, ChatGPT, Claude, etc.)
 * directly to VS Code without clipboard copy-paste.
 *
 * Default port: 3701 (configurable via codebreeze.wsBridgePort)
 * Uses the `ws` npm package (RFC 6455 compliant).
 *
 * Message types:
 *   browser → extension: { type: 'codeBlocks', blocks: CodeBlock[], source: string }
 *   browser → extension: { type: 'ping' }
 *   extension → browser: { type: 'pong' }
 *   extension → browser: { type: 'status', watching: boolean, port: number }
 */
import * as http from 'http';
import * as vscode from 'vscode';
import { WebSocketServer, WebSocket } from 'ws';
import { parseClipboard } from '../apply/markdownParser';
import { applyCodeBlocksHeadless } from '../apply/clipboardApply';
import { getConfig } from '../config';

// ── Server state ──────────────────────────────────────────────────────────

let bridgeServer: http.Server | undefined;
let wss: WebSocketServer | undefined;
let connections: WebSocket[] = [];
let statusBarItem: vscode.StatusBarItem | undefined;

// ── Public API ────────────────────────────────────────────────────────────

export function getWsBridgePort(): number {
  const cfg = vscode.workspace.getConfiguration('codebreeze');
  return cfg.get<number>('wsBridgePort') ?? 3701;
}

export function isWsBridgeRunning(): boolean {
  return !!bridgeServer;
}

export async function startWsBridge(context: vscode.ExtensionContext): Promise<void> {
  if (bridgeServer) {
    vscode.window.showInformationMessage(
      `CodeBreeze WS bridge already running on port ${getWsBridgePort()}`
    );
    return;
  }

  const port = getWsBridgePort();

  // HTTP server for health check + WebSocket upgrade
  bridgeServer = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('CodeBreeze WebSocket Bridge');
  });

  // WebSocket server in noServer mode (handles upgrade manually)
  wss = new WebSocketServer({ noServer: true });

  bridgeServer.on('upgrade', (req, socket, head) => {
    wss!.handleUpgrade(req, socket as import('net').Socket, head, (ws) => {
      wss!.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws: WebSocket) => {
    connections.push(ws);
    ws.send(JSON.stringify({ type: 'status', watching: true, port }));

    ws.on('message', (data) => {
      handleWsMessage(ws, data.toString());
    });

    ws.on('close', () => {
      connections = connections.filter((c) => c !== ws);
    });

    ws.on('error', () => {
      connections = connections.filter((c) => c !== ws);
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

  vscode.window
    .showInformationMessage(
      `CodeBreeze: Browser bridge started on ws://127.0.0.1:${port}`,
      'Copy URL'
    )
    .then((choice) => {
      if (choice === 'Copy URL') {
        vscode.env.clipboard.writeText(`ws://127.0.0.1:${port}`);
      }
    });
}

export function stopWsBridge(): void {
  if (!bridgeServer) {
    vscode.window.showInformationMessage('CodeBreeze: Browser bridge is not running');
    return;
  }
  connections.forEach((ws) => ws.close());
  connections = [];
  wss?.close();
  wss = undefined;
  bridgeServer.close();
  bridgeServer = undefined;
  statusBarItem?.dispose();
  statusBarItem = undefined;
  vscode.window.showInformationMessage('CodeBreeze: Browser bridge stopped');
}

/** Broadcast a message to all connected browser extensions */
export function broadcastToBrowser(data: unknown): void {
  const json = JSON.stringify(data);
  connections.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(json);
    }
  });
}

// ── Message handler ───────────────────────────────────────────────────────

async function handleWsMessage(ws: WebSocket, raw: string): Promise<void> {
  let msg: Record<string, unknown>;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }

  switch (msg.type) {
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong' }));
      break;

    case 'codeBlocks': {
      const blocks = (msg.blocks as { language?: string; filePath?: string; content: string }[]) || [];
      const source = String(msg.source || 'browser');
      if (blocks.length === 0) return;

      const config = getConfig();

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

        await vscode.env.clipboard.writeText(markdown);
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

    case 'getStatus':
      ws.send(JSON.stringify({ type: 'status', watching: true, port: getWsBridgePort() }));
      break;
  }
}
