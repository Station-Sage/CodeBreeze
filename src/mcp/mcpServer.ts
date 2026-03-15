/**
 * MCP (Model Context Protocol) server mode — Phase 3
 *
 * Exposes a local HTTP server that AI agents can call directly,
 * eliminating clipboard copy-paste entirely.
 *
 * Protocol: JSON-RPC 2.0 over HTTP POST /mcp
 * Default port: 3700 (configurable via codebreeze.mcpPort setting)
 */
import * as http from 'http';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getWorkspaceRoot } from '../config';
import { getDiagnosticsMarkdown } from '../collect/errorCollector';
import { getGitDiff, getGitLog, getCurrentBranch } from '../collect/gitCollector';
import { getLastBuildResult } from '../collect/localBuildCollector';
import { getProjectMap } from '../collect/projectMapCollector';
import { applyCodeBlocksHeadless } from '../apply/clipboardApply';
import { parseClipboard } from '../apply/markdownParser';


// ── Types ──────────────────────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number | null;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

// ── Tool definitions ──────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'read_file',
    description: 'Read a file from the VS Code workspace',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative file path within workspace' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write content to a workspace file (creates if not exists)',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative file path' },
        content: { type: 'string', description: 'File content' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'get_errors',
    description: 'Get current compilation/lint errors from VS Code diagnostics',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_git_diff',
    description: 'Get git diff for current workspace',
    inputSchema: {
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['unstaged', 'staged', 'head'],
          description: 'Diff mode (default: unstaged)',
        },
      },
    },
  },
  {
    name: 'get_git_log',
    description: 'Get recent git commit log',
    inputSchema: {
      type: 'object',
      properties: {
        count: { type: 'number', description: 'Number of commits (default: 10)' },
      },
    },
  },
  {
    name: 'run_build',
    description: 'Retrieve the last build result (does not re-trigger build)',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_project_map',
    description: 'Get a map of project files with their exported symbols',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'apply_code',
    description: 'Apply markdown code blocks (same as Ctrl+Shift+A). Pass markdown with fenced code blocks.',
    inputSchema: {
      type: 'object',
      properties: {
        markdown: { type: 'string', description: 'Markdown text containing fenced code blocks' },
      },
      required: ['markdown'],
    },
  },
  {
    name: 'list_files',
    description: 'List files in a workspace directory',
    inputSchema: {
      type: 'object',
      properties: {
        dir: { type: 'string', description: 'Relative directory path (default: workspace root)' },
        recursive: { type: 'boolean', description: 'Recurse into subdirectories (default: false)' },
      },
    },
  },
];

// ── Tool handlers ─────────────────────────────────────────────────────────

async function callTool(name: string, params: Record<string, unknown>): Promise<unknown> {
  const root = getWorkspaceRoot();

  switch (name) {
    case 'read_file': {
      if (!root) throw new Error('No workspace open');
      const relPath = String(params.path || '');
      const absPath = path.join(root, relPath);
      if (!absPath.startsWith(root)) throw new Error('Path outside workspace');
      const content = fs.readFileSync(absPath, 'utf8');
      return { path: relPath, content };
    }

    case 'write_file': {
      if (!root) throw new Error('No workspace open');
      const relPath = String(params.path || '');
      const content = String(params.content ?? '');
      const absPath = path.join(root, relPath);
      if (!absPath.startsWith(root)) throw new Error('Path outside workspace');
      fs.mkdirSync(path.dirname(absPath), { recursive: true });
      fs.writeFileSync(absPath, content, 'utf8');
      // Notify VS Code about the file change
      vscode.workspace.openTextDocument(absPath).then((doc) =>
        vscode.window.showTextDocument(doc, { preview: true, preserveFocus: true })
      );
      return { path: relPath, written: content.length };
    }

    case 'get_errors': {
      const md = getDiagnosticsMarkdown();
      return { markdown: md || '(no errors)', hasErrors: !!md };
    }

    case 'get_git_diff': {
      if (!root) throw new Error('No workspace open');
      const rawMode = (params.mode as string) || 'unstaged';
      const mode = (['staged', 'unstaged', 'both'].includes(rawMode) ? rawMode : 'unstaged') as 'staged' | 'unstaged' | 'both';
      const diff = getGitDiff(root, mode);
      const branch = getCurrentBranch(root);
      return { branch, mode, diff: diff || '(no changes)' };
    }

    case 'get_git_log': {
      if (!root) throw new Error('No workspace open');
      const count = Number(params.count) || 10;
      const log = getGitLog(root, count);
      return { log: log || '(no commits)' };
    }

    case 'run_build': {
      const result = getLastBuildResult();
      if (!result) return { status: 'no_build_result' };
      return {
        command: result.command,
        exitCode: result.exitCode,
        duration: result.duration,
        output: (result.stdout + result.stderr).slice(-4000),
        errorCount: result.errors.length,
      };
    }

    case 'get_project_map': {
      const map = await getProjectMap();
      return { map: map || '(empty project)' };
    }

    case 'apply_code': {
      const markdown = String(params.markdown || '');
      const blocks = parseClipboard(markdown);
      if (blocks.length === 0) return { applied: 0, message: 'No code blocks found' };
      const results = await applyCodeBlocksHeadless(blocks);
      return {
        applied: results.filter((r) => r.status === 'applied' || r.status === 'created').length,
        results,
      };
    }

    case 'list_files': {
      if (!root) throw new Error('No workspace open');
      const relDir = String(params.dir || '');
      const absDir = relDir ? path.join(root, relDir) : root;
      if (!absDir.startsWith(root)) throw new Error('Path outside workspace');
      const recursive = Boolean(params.recursive);
      const files = listDir(absDir, root, recursive);
      return { files };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function listDir(dir: string, root: string, recursive: boolean, depth = 0): string[] {
  const SKIP = ['node_modules', '.git', 'dist', 'out', 'build'];
  const MAX_DEPTH = 3;
  const results: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const e of entries) {
    if (SKIP.includes(e.name)) continue;
    const abs = path.join(dir, e.name);
    const rel = path.relative(root, abs);
    if (e.isDirectory()) {
      results.push(rel + '/');
      if (recursive && depth < MAX_DEPTH) {
        results.push(...listDir(abs, root, recursive, depth + 1));
      }
    } else {
      results.push(rel);
    }
  }
  return results;
}

// ── HTTP server ───────────────────────────────────────────────────────────

let server: http.Server | undefined;
let statusBarMcpItem: vscode.StatusBarItem | undefined;

export function getMcpPort(): number {
  const cfg = vscode.workspace.getConfiguration('codebreeze');
  return cfg.get<number>('mcpPort') ?? 3700;
}

export function isMcpRunning(): boolean {
  return !!server;
}

export async function startMcpServer(context: vscode.ExtensionContext): Promise<void> {
  if (server) {
    vscode.window.showInformationMessage(`CodeBreeze MCP server already running on port ${getMcpPort()}`);
    return;
  }

  const port = getMcpPort();

  server = http.createServer(async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', version: '1.0', tools: TOOLS.length }));
      return;
    }

    if (req.method !== 'POST') {
      res.writeHead(405);
      res.end('Method Not Allowed');
      return;
    }

    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', async () => {
      res.setHeader('Content-Type', 'application/json');
      let rpcReq: JsonRpcRequest;
      try {
        rpcReq = JSON.parse(body);
      } catch {
        const resp: JsonRpcResponse = { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } };
        res.writeHead(400);
        res.end(JSON.stringify(resp));
        return;
      }

      const resp = await handleRpc(rpcReq);
      res.writeHead(200);
      res.end(JSON.stringify(resp));
    });
  });

  await new Promise<void>((resolve, reject) => {
    server!.listen(port, '127.0.0.1', () => resolve());
    server!.on('error', reject);
  });

  // Status bar
  statusBarMcpItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 90);
  statusBarMcpItem.text = `$(plug) MCP :${port}`;
  statusBarMcpItem.tooltip = `CodeBreeze MCP server running on http://127.0.0.1:${port}\nClick to stop`;
  statusBarMcpItem.command = 'codebreeze.stopMcpServer';
  statusBarMcpItem.show();
  context.subscriptions.push(statusBarMcpItem);

  vscode.window.showInformationMessage(
    `CodeBreeze: MCP server started on http://127.0.0.1:${port}`,
    'Copy URL'
  ).then((choice) => {
    if (choice === 'Copy URL') {
      vscode.env.clipboard.writeText(`http://127.0.0.1:${port}`);
    }
  });
}

export function stopMcpServer(): void {
  if (!server) {
    vscode.window.showInformationMessage('CodeBreeze: MCP server is not running');
    return;
  }
  server.close();
  server = undefined;
  statusBarMcpItem?.dispose();
  statusBarMcpItem = undefined;
  vscode.window.showInformationMessage('CodeBreeze: MCP server stopped');
}

async function handleRpc(req: JsonRpcRequest): Promise<JsonRpcResponse> {
  const { id, method, params } = req;

  try {
    if (method === 'tools/list') {
      return { jsonrpc: '2.0', id, result: { tools: TOOLS } };
    }

    if (method === 'tools/call') {
      const p = params as { name: string; arguments?: Record<string, unknown> };
      const result = await callTool(p.name, p.arguments ?? {});
      return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] } };
    }

    // Legacy direct endpoint for convenience
    if (method.startsWith('tool/')) {
      const toolName = method.slice(5);
      const result = await callTool(toolName, (params as Record<string, unknown>) ?? {});
      return { jsonrpc: '2.0', id, result };
    }

    return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
  } catch (err) {
    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32000, message: err instanceof Error ? err.message : String(err) },
    };
  }
}

