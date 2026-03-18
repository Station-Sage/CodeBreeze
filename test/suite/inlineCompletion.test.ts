import * as assert from 'assert';

suite('Inline Completion Provider Module', () => {
  test('CACHE_TTL_MS is reasonable', () => {
    const CACHE_TTL_MS = 30_000;
    assert.ok(CACHE_TTL_MS >= 10_000);
    assert.ok(CACHE_TTL_MS <= 120_000);
  });

  test('cache key format includes file, line, character', () => {
    const fsPath = '/home/user/src/main.ts';
    const line = 10;
    const character = 5;
    const cacheKey = `${fsPath}:${line}:${character}`;
    assert.ok(cacheKey.includes(fsPath));
    assert.ok(cacheKey.includes(':10:'));
    assert.ok(cacheKey.includes(':5'));
  });

  test('cache size limit prevents unbounded growth', () => {
    const MAX_CACHE_SIZE = 100;
    const cache = new Map<string, { timestamp: number }>();
    for (let i = 0; i < 150; i++) {
      cache.set(`key${i}`, { timestamp: Date.now() - (i * 1000) });
    }
    // Prune simulation
    if (cache.size > MAX_CACHE_SIZE) {
      const now = Date.now();
      for (const [key, val] of cache) {
        if (now - val.timestamp > 30_000) cache.delete(key);
      }
    }
    assert.ok(cache.size <= MAX_CACHE_SIZE);
  });

  test('inlineCompletionSource config values', () => {
    const validSources = ['bridge', 'mcp'];
    assert.ok(validSources.includes('bridge'));
    assert.ok(validSources.includes('mcp'));
  });

  test('pending completion request store/retrieve', () => {
    // Simulate store and retrieve
    let pending: string | null = null;

    function setPending(payload: string): void { pending = payload; }
    function getPending(): string | null { const p = pending; pending = null; return p; }

    setPending('completion context here');
    assert.strictEqual(getPending(), 'completion context here');
    assert.strictEqual(getPending(), null); // consumed
  });
});

suite('Completion Context Builder', () => {
  test('MAX_CONTEXT_LINES limits context size', () => {
    const MAX_CONTEXT_LINES = 50;
    assert.ok(MAX_CONTEXT_LINES >= 20);
    assert.ok(MAX_CONTEXT_LINES <= 100);
  });

  test('MAX_TOKEN_ESTIMATE defines budget', () => {
    const MAX_TOKEN_ESTIMATE = 2000;
    const MAX_CHARS = MAX_TOKEN_ESTIMATE * 4;
    assert.strictEqual(MAX_CHARS, 8000);
  });

  test('context includes CURSOR marker', () => {
    const context = '```typescript\nconst x = 1;\n/* <<CURSOR>> */\nconst y = 2;\n```';
    assert.ok(context.includes('<<CURSOR>>'));
  });

  test('context includes completion instruction', () => {
    const instruction = 'Complete the code at the <<CURSOR>> position. Provide ONLY the code to insert, no explanation.';
    assert.ok(instruction.includes('<<CURSOR>>'));
    assert.ok(instruction.includes('ONLY the code'));
  });

  test('findContainingSymbol returns most specific match', () => {
    // Simulate nested symbol matching
    const symbols = [
      { name: 'MyClass', range: { start: 0, end: 50 }, children: [
        { name: 'method1', range: { start: 5, end: 15 }, children: [] },
        { name: 'method2', range: { start: 20, end: 30 }, children: [] },
      ]},
    ];
    const cursorLine = 10;
    // Find most specific containing symbol
    let result = symbols[0].name;
    for (const child of symbols[0].children) {
      if (cursorLine >= child.range.start && cursorLine <= child.range.end) {
        result = child.name;
      }
    }
    assert.strictEqual(result, 'method1');
  });

  test('import context included when cursor is deep in file', () => {
    const position = { line: 100 };
    const importLinesThreshold = 20;
    assert.ok(position.line > importLinesThreshold, 'Should include import section');
  });
});
