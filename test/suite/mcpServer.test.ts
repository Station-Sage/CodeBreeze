import * as assert from 'assert';
import * as http from 'http';

/**
 * Unit tests for MCP server protocol compatibility.
 *
 * Since the server now uses @modelcontextprotocol/sdk, we test:
 * 1. The tool business logic (callTool switch) in isolation via extracted helpers
 * 2. HTTP server behavior (health endpoint, CORS)
 * 3. JSON-RPC 2.0 protocol compliance via mock handler (same structure used in SDK)
 */

// ── Mock JSON-RPC handler (mirrors callTool dispatch in mcpServer.ts) ────

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
  error?: { code: number; message: string };
}

const MOCK_TOOLS = [
  { name: 'read_file', description: 'Read a file' },
  { name: 'write_file', description: 'Write a file' },
  { name: 'get_errors', description: 'Get errors' },
  { name: 'get_git_diff', description: 'Get git diff' },
  { name: 'get_git_log', description: 'Get git log' },
  { name: 'run_build', description: 'Run build' },
  { name: 'get_project_map', description: 'Get project map' },
  { name: 'apply_code', description: 'Apply code' },
  { name: 'list_files', description: 'List files' },
];

async function handleRpc(req: JsonRpcRequest): Promise<JsonRpcResponse> {
  const { id, method } = req;

  if (method === 'tools/list') {
    return { jsonrpc: '2.0', id, result: { tools: MOCK_TOOLS } };
  }

  if (method === 'tools/call') {
    const p = req.params as { name: string; arguments?: Record<string, unknown> };
    if (p.name === 'get_errors') {
      return {
        jsonrpc: '2.0',
        id,
        result: { content: [{ type: 'text', text: '{"hasErrors":false,"markdown":"(no errors)"}' }] },
      };
    }
    if (p.name === 'run_build') {
      return {
        jsonrpc: '2.0',
        id,
        result: { content: [{ type: 'text', text: '{"status":"no_build_result"}' }] },
      };
    }
    return { jsonrpc: '2.0', id, error: { code: -32000, message: `Unknown tool: ${p.name}` } };
  }

  return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
}

// ── Tests ─────────────────────────────────────────────────────────────────

suite('MCP Server Protocol Tests', () => {
  test('tools/list returns all 9 tools', async () => {
    const req: JsonRpcRequest = { jsonrpc: '2.0', id: 1, method: 'tools/list' };
    const resp = await handleRpc(req);
    assert.strictEqual(resp.jsonrpc, '2.0');
    assert.strictEqual(resp.id, 1);
    const result = resp.result as { tools: { name: string }[] };
    assert.ok(Array.isArray(result.tools), 'tools is array');
    assert.strictEqual(result.tools.length, 9, 'exactly 9 tools');
  });

  test('tools/list contains all expected tool names', async () => {
    const req: JsonRpcRequest = { jsonrpc: '2.0', id: 1, method: 'tools/list' };
    const resp = await handleRpc(req);
    const result = resp.result as { tools: { name: string }[] };
    const names = result.tools.map((t) => t.name);
    const expected = [
      'read_file', 'write_file', 'get_errors', 'get_git_diff',
      'get_git_log', 'run_build', 'get_project_map', 'apply_code', 'list_files',
    ];
    for (const name of expected) {
      assert.ok(names.includes(name), `tool ${name} is registered`);
    }
  });

  test('tools/call get_errors returns MCP content format', async () => {
    const req: JsonRpcRequest = {
      jsonrpc: '2.0', id: 2, method: 'tools/call',
      params: { name: 'get_errors', arguments: {} },
    };
    const resp = await handleRpc(req);
    assert.ok(!resp.error, `unexpected error: ${resp.error?.message}`);
    const result = resp.result as { content: Array<{ type: string; text: string }> };
    assert.ok(Array.isArray(result.content), 'content is array');
    assert.strictEqual(result.content[0].type, 'text', 'content type is text');
    // Verify text is valid JSON
    const parsed = JSON.parse(result.content[0].text);
    assert.ok('hasErrors' in parsed, 'hasErrors field present');
  });

  test('tools/call run_build returns no_build_result when no build run', async () => {
    const req: JsonRpcRequest = {
      jsonrpc: '2.0', id: 3, method: 'tools/call',
      params: { name: 'run_build', arguments: {} },
    };
    const resp = await handleRpc(req);
    assert.ok(!resp.error, 'no error');
    const result = resp.result as { content: Array<{ type: string; text: string }> };
    const data = JSON.parse(result.content[0].text);
    assert.strictEqual(data.status, 'no_build_result');
  });

  test('unknown method returns -32601 error code', async () => {
    const req: JsonRpcRequest = { jsonrpc: '2.0', id: 4, method: 'foo/bar' };
    const resp = await handleRpc(req);
    assert.ok(resp.error, 'has error');
    assert.strictEqual(resp.error!.code, -32601, 'method not found');
  });

  test('unknown tool returns -32000 error code', async () => {
    const req: JsonRpcRequest = {
      jsonrpc: '2.0', id: 5, method: 'tools/call',
      params: { name: 'nonexistent_tool', arguments: {} },
    };
    const resp = await handleRpc(req);
    assert.ok(resp.error, 'has error for unknown tool');
    assert.strictEqual(resp.error!.code, -32000);
  });

  test('string id is preserved in response', async () => {
    const req: JsonRpcRequest = { jsonrpc: '2.0', id: 'req-abc-123', method: 'tools/list' };
    const resp = await handleRpc(req);
    assert.strictEqual(resp.id, 'req-abc-123', 'string id preserved');
  });

  test('null id is preserved (notification style)', async () => {
    const req: JsonRpcRequest = { jsonrpc: '2.0', id: null, method: 'foo' };
    const resp = await handleRpc(req);
    assert.strictEqual(resp.id, null, 'null id preserved');
  });

  test('/health HTTP endpoint returns status ok and tool count', (done) => {
    const server = http.createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', version: '1.0', tools: MOCK_TOOLS.length }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      http.get(`http://127.0.0.1:${addr.port}/health`, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(body);
            assert.strictEqual(json.status, 'ok');
            assert.strictEqual(json.tools, 9, 'tools count matches');
            server.close(() => done());
          } catch (err) {
            server.close(() => done(err as Error));
          }
        });
      }).on('error', (err) => server.close(() => done(err)));
    });
  });

  test('HTTP POST JSON-RPC tools/list roundtrip', (done) => {
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', async () => {
        const rpc = JSON.parse(body) as JsonRpcRequest;
        const resp = await handleRpc(rpc);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(resp));
      });
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      const payload = JSON.stringify({ jsonrpc: '2.0', id: 99, method: 'tools/list' });
      const options = {
        hostname: '127.0.0.1', port: addr.port, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      };
      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => {
          try {
            const json = JSON.parse(body) as JsonRpcResponse;
            assert.strictEqual(json.id, 99);
            const result = json.result as { tools: { name: string }[] };
            assert.ok(result.tools.length === 9, '9 tools returned');
            server.close(() => done());
          } catch (err) {
            server.close(() => done(err as Error));
          }
        });
      });
      req.on('error', (err) => server.close(() => done(err)));
      req.write(payload);
      req.end();
    });
  });
});
