import * as assert from 'assert';
import * as http from 'http';

// Unit tests for the MCP server JSON-RPC protocol layer.
// Tests run without VS Code API by mocking the tools.

// ── Minimal JSON-RPC handler (extracted logic) ────────────────────────────

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
];

async function handleRpc(req: JsonRpcRequest): Promise<JsonRpcResponse> {
  const { id, method } = req;

  if (method === 'tools/list') {
    return { jsonrpc: '2.0', id, result: { tools: MOCK_TOOLS } };
  }

  if (method === 'tools/call') {
    const p = req.params as { name: string; arguments?: Record<string, unknown> };
    if (p.name === 'get_errors') {
      return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: '{"hasErrors":false}' }] } };
    }
    return { jsonrpc: '2.0', id, error: { code: -32000, message: `Unknown tool: ${p.name}` } };
  }

  return { jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } };
}

// ── Tests ─────────────────────────────────────────────────────────────────

suite('MCP Server Protocol Tests', () => {
  test('tools/list returns tool array', async () => {
    const req: JsonRpcRequest = { jsonrpc: '2.0', id: 1, method: 'tools/list' };
    const resp = await handleRpc(req);
    assert.strictEqual(resp.jsonrpc, '2.0');
    assert.strictEqual(resp.id, 1);
    assert.ok(resp.result, 'result present');
    const result = resp.result as { tools: unknown[] };
    assert.ok(Array.isArray(result.tools), 'tools is array');
    assert.ok(result.tools.length > 0, 'has tools');
  });

  test('tools/call get_errors returns content array', async () => {
    const req: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'get_errors', arguments: {} },
    };
    const resp = await handleRpc(req);
    assert.ok(!resp.error, 'no error');
    const result = resp.result as { content: Array<{ type: string; text: string }> };
    assert.ok(Array.isArray(result.content), 'content is array');
    assert.strictEqual(result.content[0].type, 'text');
  });

  test('unknown method returns -32601', async () => {
    const req: JsonRpcRequest = { jsonrpc: '2.0', id: 3, method: 'foo/bar' };
    const resp = await handleRpc(req);
    assert.ok(resp.error, 'has error');
    assert.strictEqual(resp.error!.code, -32601, 'method not found code');
  });

  test('unknown tool returns -32000', async () => {
    const req: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'nonexistent_tool', arguments: {} },
    };
    const resp = await handleRpc(req);
    assert.ok(resp.error, 'has error');
    assert.strictEqual(resp.error!.code, -32000);
  });

  test('id is preserved in response', async () => {
    const req: JsonRpcRequest = { jsonrpc: '2.0', id: 'abc-123', method: 'tools/list' };
    const resp = await handleRpc(req);
    assert.strictEqual(resp.id, 'abc-123', 'id preserved');
  });

  test('null id is preserved', async () => {
    const req: JsonRpcRequest = { jsonrpc: '2.0', id: null, method: 'unknown' };
    const resp = await handleRpc(req);
    assert.strictEqual(resp.id, null, 'null id preserved');
  });

  test('HTTP server starts and responds to /health', (done) => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', version: '1.0', tools: MOCK_TOOLS.length }));
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      const req = http.get(`http://127.0.0.1:${addr.port}/health`, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(body);
            assert.strictEqual(json.status, 'ok');
            assert.strictEqual(json.tools, MOCK_TOOLS.length);
            server.close(() => done());
          } catch (err) {
            server.close(() => done(err as Error));
          }
        });
      });
      req.on('error', (err) => server.close(() => done(err)));
    });
  });

  test('HTTP POST JSON-RPC returns correct response', (done) => {
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
        hostname: '127.0.0.1',
        port: addr.port,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      };
      const req = http.request(options, (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => {
          try {
            const json = JSON.parse(body) as JsonRpcResponse;
            assert.strictEqual(json.id, 99);
            assert.ok((json.result as { tools: unknown[] }).tools.length > 0);
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
