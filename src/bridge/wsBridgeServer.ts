/**
 * WebSocket Bridge Server — Phase 4
 *
 * VS Code extension side of the browser extension bridge.
 * Browser extension connects via WebSocket and sends code blocks
 * detected from AI chat pages (Genspark, ChatGPT, Claude, etc.)
 * directly to VS Code without clipboard copy-paste.
 *
 * Default port: 3701 (configurable via codebreeze.wsBridgePort)
 * Protocol: simple JSON messages
 *
 * Message types:
 *   browser → extension: { type: 'codeBlocks', blocks: CodeBlock[], source: string }
 *   browser → extension: { type: 'ping' }
 *   extension → browser: { type: 'pong' }
 *   extension → browser: { type: 'status', watching: boolean, port: number }
 */
import * as http from 'http';
import * as vscode from 'vscode';
import { parseClipboard } from '../apply/markdownParser';
import { applyCodeBlocksHeadless } from '../apply/clipboardApply';
import { getConfig } from '../config';

// ── Minimal WebSocket frame parser ──────────────────────────────────────

function buildWsHandshakeResponse(key: string): string {
  const crypto = require('crypto') as typeof import('crypto');
  const magic = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
  const hash = crypto.createHash('sha1').update(key + magic).digest('base64');
  return [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${hash}`,
    '',
    '',
  ].join('\r\n');
}

function parseWsFrame(buf: Buffer): { payload: Buffer; fin: boolean } | null {
  if (buf.length < 2) return null;
  const fin = (buf[0] & 0x80) !== 0;
  const masked = (buf[1] & 0x80) !== 0;
  let payloadLen = buf[1] & 0x7f;
  let offset = 2;
  if (payloadLen === 126) {
    if (buf.length < 4) return null;
    payloadLen = buf.readUInt16BE(2);
    offset = 4;
  } else if (payloadLen === 127) {
    offset = 10;
  }
  const maskKey = masked ? buf.slice(offset, offset + 4) : null;
  if (masked) offset += 4;
  if (buf.length < offset + payloadLen) return null;
  const payload = buf.slice(offset, offset + payloadLen);
  if (maskKey) {
    for (let i = 0; i < payload.length; i++) {
      payload[i] ^= maskKey[i % 4];
    }
  }
  return { payload, fin };
}

function buildWsFrame(data: string): Buffer {
  const payload = Buffer.from(data, 'utf8');
  const len = payload.length;
  let header: Buffer;
  if (len < 126) {
    header = Buffer.from([0x81, len]);
  } else if (len < 65536) {
    header = Buffer.from([0x81, 126, (len >> 8) & 0xff, len & 0xff]);
  } else {
    header = Buffer.from([0x81, 127, 0, 0, 0, 0, (len >> 24) & 0xff, (len >> 16) & 0xff, (len >> 8) & 0xff, len & 0xff]);
  }
  return Buffer.concat([header, payload]);
}

// ── WebSocket connection ─────────────────────────────────────────────────

interface WsConnection {
  socket: import('net').Socket;
  send(data: string): void;
  close(): void;
}

function createWsConnection(socket: import('net').Socket): WsConnection {
  const conn: WsConnection = {
    socket,
    send(data: string) {
      if (!socket.destroyed) {
        socket.write(buildWsFrame(data));
      }
    },
    close() {
      if (!socket.destroyed) socket.destroy();
    },
  };
  return conn;
}

// ── Bridge server ─────────────────────────────────────────────────────────

let bridgeServer: http.Server | undefined;
let connections: WsConnection[] = [];
let statusBarItem: vscode.StatusBarItem | undefined;

export function getWsBridgePort(): number {
  const cfg = vscode.workspace.getConfiguration('codebreeze');
  return cfg.get<number>('wsBridgePort') ?? 3701;
}

export function isWsBridgeRunning(): boolean {
  return !!bridgeServer;
}

export async function startWsBridge(context: vscode.ExtensionContext): Promise<void> {
  if (bridgeServer) {
    vscode.window.showInformationMessage(`CodeBreeze WS bridge already running on port ${getWsBridgePort()}`);
    return;
  }

  const port = getWsBridgePort();

  bridgeServer = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('CodeBreeze WebSocket Bridge');
  });

  bridgeServer.on('upgrade', (req, socket: import('net').Socket) => {
    const wsKey = req.headers['sec-websocket-key'];
    if (!wsKey) { socket.destroy(); return; }

    socket.write(buildWsHandshakeResponse(wsKey as string));

    const conn = createWsConnection(socket);
    connections.push(conn);

    // Send status
    conn.send(JSON.stringify({ type: 'status', watching: true, port }));

    let buf = Buffer.alloc(0);
    socket.on('data', (chunk: Buffer) => {
      buf = Buffer.concat([buf, chunk]);
      const frame = parseWsFrame(buf);
      if (!frame) return;
      buf = Buffer.alloc(0);
      handleWsMessage(conn, frame.payload.toString('utf8'));
    });

    socket.on('close', () => {
      connections = connections.filter((c) => c !== conn);
    });

    socket.on('error', () => {
      connections = connections.filter((c) => c !== conn);
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

  vscode.window.showInformationMessage(
    `CodeBreeze: Browser bridge started on ws://127.0.0.1:${port}`,
    'Copy URL'
  ).then((choice) => {
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
  connections.forEach((c) => c.close());
  connections = [];
  bridgeServer.close();
  bridgeServer = undefined;
  statusBarItem?.dispose();
  statusBarItem = undefined;
  vscode.window.showInformationMessage('CodeBreeze: Browser bridge stopped');
}

async function handleWsMessage(conn: WsConnection, raw: string): Promise<void> {
  let msg: Record<string, unknown>;
  try {
    msg = JSON.parse(raw);
  } catch {
    return;
  }

  switch (msg.type) {
    case 'ping':
      conn.send(JSON.stringify({ type: 'pong' }));
      break;

    case 'codeBlocks': {
      // Browser detected code blocks in AI chat
      const blocks = (msg.blocks as { language?: string; filePath?: string; content: string }[]) || [];
      const source = String(msg.source || 'browser');

      if (blocks.length === 0) return;

      const config = getConfig();

      if (config.autoLevel === 'auto') {
        // Auto-apply headlessly
        const cbBlocks = blocks.map((b) => ({
          language: b.language || '',
          filePath: b.filePath || null,
          content: b.content,
          isDiff: false,
        }));
        const results = await applyCodeBlocksHeadless(cbBlocks);
        const applied = results.filter((r) => r.status === 'applied' || r.status === 'created').length;
        conn.send(JSON.stringify({ type: 'applyResult', applied, results }));
        vscode.window.showInformationMessage(`CodeBreeze Bridge: ${applied} block(s) applied from ${source}`);
      } else {
        // Write to clipboard and notify
        const markdown = blocks.map((b) => {
          const lang = b.language || '';
          const fp = b.filePath ? `// ${b.filePath}\n` : '';
          return `\`\`\`${lang}\n${fp}${b.content}\n\`\`\``;
        }).join('\n\n');

        await vscode.env.clipboard.writeText(markdown);
        conn.send(JSON.stringify({ type: 'clipboardReady', count: blocks.length }));

        vscode.window
          .showInformationMessage(
            `CodeBreeze Bridge: ${blocks.length} code block(s) from ${source} — ready to apply`,
            'Apply Now'
          )
          .then((choice) => {
            if (choice === 'Apply Now') {
              const cbBlocks = parseClipboard(markdown);
              applyCodeBlocksHeadless(cbBlocks).then((results) => {
                const applied = results.filter((r) => r.status === 'applied' || r.status === 'created').length;
                vscode.window.showInformationMessage(`CodeBreeze: ${applied} block(s) applied`);
              });
            }
          });
      }
      break;
    }

    case 'getStatus':
      conn.send(JSON.stringify({ type: 'status', watching: true, port: getWsBridgePort() }));
      break;
  }
}

/** Broadcast a message to all connected browser extensions */
export function broadcastToBrowser(data: unknown): void {
  const json = JSON.stringify(data);
  connections.forEach((c) => c.send(json));
}
