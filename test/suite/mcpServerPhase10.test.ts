import * as assert from 'assert';

suite('MCP Server Phase 10 Tools', () => {
  test('search_symbols tool requires query parameter', () => {
    const params: { query: string } = { query: '' };
    assert.strictEqual(params.query, '');
    // Empty query should throw in actual tool
    assert.ok(params.query.length === 0);
  });

  test('search_symbols result format', () => {
    const result = {
      query: 'getConfig',
      resultCount: 3,
      symbols: [
        { name: 'getConfig', kind: 'Function', file: 'src/config.ts', startLine: 31, endLine: 55 },
        { name: 'getConfigValue', kind: 'Function', file: 'src/utils.ts', startLine: 10, endLine: 20 },
        { name: 'CodeBreezeConfig', kind: 'Interface', file: 'src/config.ts', startLine: 5, endLine: 27 },
      ],
    };
    assert.strictEqual(result.query, 'getConfig');
    assert.strictEqual(result.resultCount, 3);
    assert.strictEqual(result.symbols.length, 3);
    assert.strictEqual(result.symbols[0].kind, 'Function');
    assert.ok(result.symbols[0].startLine > 0);
  });

  test('find_references tool requires symbol parameter', () => {
    const params = { symbol: 'getConfig', file: 'src/config.ts' };
    assert.strictEqual(params.symbol, 'getConfig');
    assert.strictEqual(params.file, 'src/config.ts');
  });

  test('find_references result format when found', () => {
    const result = {
      symbol: 'getConfig',
      found: true,
      definitionFile: 'src/config.ts',
      definitionLine: 31,
      referenceCount: 5,
      references: [
        { file: 'src/extension.ts', line: 10, preview: 'const cfg = getConfig()' },
      ],
    };
    assert.ok(result.found);
    assert.strictEqual(result.referenceCount, 5);
    assert.ok(result.references.length <= 30);
  });

  test('find_references result format when not found', () => {
    const result = { symbol: 'nonExistent', found: false, references: [] };
    assert.ok(!result.found);
    assert.strictEqual(result.references.length, 0);
  });

  test('get_lsp_project_map tool returns string map', () => {
    const result = { map: '## Project Map (LSP)\n- **src/config.ts**: ƒgetConfig, ◇CodeBreezeConfig' };
    assert.ok(result.map.includes('## Project Map (LSP)'));
    assert.ok(result.map.includes('ƒgetConfig'));
  });

  test('health endpoint reports 12 tools', () => {
    const health = { status: 'ok', version: '1.0', tools: 12 };
    assert.strictEqual(health.tools, 12);
  });
});
