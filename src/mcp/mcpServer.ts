/**
 * MCP (Model Context Protocol) server mode — Phase 3
 *
 * Exposes a local HTTP server using the official @modelcontextprotocol/sdk.
 * AI agents (Claude Desktop, Cursor, Genspark MCP etc.) can call tools directly,
 * eliminating clipboard copy-paste entirely.
 *
 * Protocol: MCP over Streamable HTTP (JSON-RPC 2.0 compatible)
 * Default port: 3700 (configurable via codebreeze.mcpPort setting)
 *
 * Tools exposed:
 *   read_file, write_file, get_errors, get_git_diff, get_git_log,
 *   run_build, get_project_map, apply_code, list_files,
 *   search_symbols, find_references, get_lsp_project_map
 */
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { getWorkspaceRoot } from '../config';
import { getDiagnosticsMarkdown } from '../collect/errorCollector';
import { getGitDiff, getGitLog, getCurrentBranch } from '../collect/gitCollector';
import { getLastBuildResult } from '../collect/localBuildCollector';
import { getProjectMap } from '../collect/projectMapCollector';
import { applyCodeBlocksHeadless } from '../apply/clipboardApply';
import { parseClipboard } from '../apply/markdownParser';
import { indexWorkspace, searchSymbols, getAllSymbolsFlat } from '../collect/lspIndexer';
import { findReferencesByName } from '../collect/lspReferences';

// ── Server state ──────────────────────────────────────────────────────────

let httpServer: http.Server | undefined;
let statusBarMcpItem: vscode.StatusBarItem | undefined;

// ── Helpers ───────────────────────────────────────────────────────────────

export function getMcpPort(): number {
  const cfg = vscode.workspace.getConfiguration('codebreeze');
  return cfg.get<number>('mcpPort') ?? 3700;
}

export function isMcpRunning(): boolean {
  return !!httpServer;
}

/** Shared tool business logic — reused by all tool registrations */
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
      vscode.workspace
        .openTextDocument(absPath)
        .then((doc) => vscode.window.showTextDocument(doc, { preview: true, preserveFocus: true }));
      return { path: relPath, written: content.length };
    }

    case 'get_errors': {
      const md = getDiagnosticsMarkdown();
      return { markdown: md || '(no errors)', hasErrors: !!md };
    }

    case 'get_git_diff': {
      if (!root) throw new Error('No workspace open');
      const rawMode = (params.mode as string) || 'unstaged';
      const mode = (['staged', 'unstaged', 'both'].includes(rawMode)
        ? rawMode
        : 'unstaged') as 'staged' | 'unstaged' | 'both';
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

    case 'search_symbols': {
      const query = String(params.query || '');
      if (!query) throw new Error('query is required');
      await indexWorkspace();
      const matches = searchSymbols(query);
      return {
        query,
        resultCount: matches.length,
        symbols: matches.slice(0, 50).map((s) => ({
          name: s.name,
          kind: vscode.SymbolKind[s.kind],
          file: s.file,
          startLine: s.range.startLine + 1,
          endLine: s.range.endLine + 1,
        })),
      };
    }

    case 'find_references': {
      const symName = String(params.symbol || '');
      if (!symName) throw new Error('symbol name is required');
      const fileHint = params.file ? String(params.file) : undefined;
      const result = await findReferencesByName(symName, fileHint);
      if (!result) return { symbol: symName, found: false, references: [] };
      return {
        symbol: result.symbol,
        found: true,
        definitionFile: result.definitionFile,
        definitionLine: result.definitionLine,
        referenceCount: result.references.length,
        references: result.references.slice(0, 30),
      };
    }

    case 'get_lsp_project_map': {
      const { getLspProjectMap } = await import('../collect/lspIndexer');
      const map = await getLspProjectMap();
      return { map: map || '(empty project or LSP unavailable)' };
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

/** Wrap any tool result as MCP content array */
function toContent(result: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
}

// ── Server lifecycle ──────────────────────────────────────────────────────

export async function startMcpServer(context: vscode.ExtensionContext): Promise<void> {
  if (httpServer) {
    vscode.window.showInformationMessage(
      `CodeBreeze MCP server already running on port ${getMcpPort()}`
    );
    return;
  }

  const port = getMcpPort();

  // ── Register tools ──
  const mcpServer = new McpServer({ name: 'codebreeze', version: '1.0.0' });

  mcpServer.tool('read_file', 'Read a file from the VS Code workspace', { path: z.string() },
    async ({ path: p }) => toContent(await callTool('read_file', { path: p })));

  mcpServer.tool('write_file', 'Write content to a workspace file (creates if not exists)',
    { path: z.string(), content: z.string() },
    async ({ path: p, content: c }) => toContent(await callTool('write_file', { path: p, content: c })));

  mcpServer.tool('get_errors', 'Get current compilation/lint errors from VS Code diagnostics', {},
    async () => toContent(await callTool('get_errors', {})));

  mcpServer.tool('get_git_diff', 'Get git diff for the current workspace',
    { mode: z.enum(['staged', 'unstaged', 'both']).optional() },
    async ({ mode }) => toContent(await callTool('get_git_diff', { mode })));

  mcpServer.tool('get_git_log', 'Get recent git commit log',
    { count: z.number().optional() },
    async ({ count }) => toContent(await callTool('get_git_log', { count })));

  mcpServer.tool('run_build', 'Retrieve the last build result', {},
    async () => toContent(await callTool('run_build', {})));

  mcpServer.tool('get_project_map', 'Get a map of project files with their exported symbols', {},
    async () => toContent(await callTool('get_project_map', {})));

  mcpServer.tool('apply_code',
    'Apply markdown code blocks to workspace files (same as Ctrl+Shift+A)',
    { markdown: z.string() },
    async ({ markdown }) => toContent(await callTool('apply_code', { markdown })));

  mcpServer.tool('list_files', 'List files in a workspace directory',
    { dir: z.string().optional(), recursive: z.boolean().optional() },
    async ({ dir, recursive }) => toContent(await callTool('list_files', { dir, recursive })));

  mcpServer.tool('search_symbols', 'Search for symbols (functions, classes, etc.) across the workspace using LSP',
    { query: z.string() },
    async ({ query }) => toContent(await callTool('search_symbols', { query })));

  mcpServer.tool('find_references', 'Find all references to a symbol by name',
    { symbol: z.string(), file: z.string().optional() },
    async ({ symbol, file }) => toContent(await callTool('find_references', { symbol, file })));

  mcpServer.tool('get_lsp_project_map', 'Get LSP-enhanced project map with accurate symbol information',
    {},
    async () => toContent(await callTool('get_lsp_project_map', {})));

  // ── HTTP server with StreamableHTTP transport ──
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await mcpServer.connect(transport);

  httpServer = http.createServer(async (req, res) => {
    // CORS for local AI clients
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, MCP-Session-Id');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', version: '1.0', tools: 12 }));
      return;
    }

    // All MCP traffic goes through the transport
    await transport.handleRequest(req, res);
  });

  await new Promise<void>((resolve, reject) => {
    httpServer!.listen(port, '127.0.0.1', () => resolve());
    httpServer!.on('error', reject);
  });

  // Status bar
  statusBarMcpItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 90);
  statusBarMcpItem.text = `$(plug) MCP :${port}`;
  statusBarMcpItem.tooltip = `CodeBreeze MCP server running on http://127.0.0.1:${port}\nClick to stop`;
  statusBarMcpItem.command = 'codebreeze.stopMcpServer';
  statusBarMcpItem.show();
  context.subscriptions.push(statusBarMcpItem);

  vscode.window
    .showInformationMessage(
      `CodeBreeze: MCP server started on http://127.0.0.1:${port}`,
      'Copy URL'
    )
    .then((choice) => {
      if (choice === 'Copy URL') {
        vscode.env.clipboard.writeText(`http://127.0.0.1:${port}`);
      }
    });
}

export function stopMcpServer(): void {
  if (!httpServer) {
    vscode.window.showInformationMessage('CodeBreeze: MCP server is not running');
    return;
  }
  httpServer.close();
  httpServer = undefined;
  statusBarMcpItem?.dispose();
  statusBarMcpItem = undefined;
  vscode.window.showInformationMessage('CodeBreeze: MCP server stopped');
}
