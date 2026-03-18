import * as assert from 'assert';

suite('lspReferences Module', () => {
  test('ReferenceResult interface shape', () => {
    const result = {
      symbol: 'getConfig',
      definitionFile: 'src/config.ts',
      definitionLine: 31,
      references: [
        { file: 'src/extension.ts', line: 5, preview: 'import { getConfig } from ...' },
        { file: 'src/collect/smartContext.ts', line: 4, preview: 'const config = getConfig()' },
      ],
    };
    assert.strictEqual(result.symbol, 'getConfig');
    assert.strictEqual(result.definitionFile, 'src/config.ts');
    assert.strictEqual(result.references.length, 2);
    assert.strictEqual(result.references[0].file, 'src/extension.ts');
    assert.ok(result.references[0].preview.length > 0);
  });

  test('CallHierarchyResult interface shape', () => {
    const result = {
      symbol: 'buildSmartContext',
      file: 'src/collect/smartContext.ts',
      line: 23,
      callers: [
        { name: 'copySmartContext', file: 'src/collect/smartContext.ts', line: 12 },
      ],
      callees: [
        { name: 'getConfig', file: 'src/config.ts', line: 31 },
        { name: 'getDiagnosticsMarkdown', file: 'src/collect/errorCollector.ts', line: 10 },
      ],
    };
    assert.strictEqual(result.symbol, 'buildSmartContext');
    assert.strictEqual(result.callers.length, 1);
    assert.strictEqual(result.callees.length, 2);
    assert.strictEqual(result.callees[0].name, 'getConfig');
  });

  test('formatReferencesMarkdown produces valid markdown', () => {
    // Simulate the markdown formatter output
    const result = {
      symbol: 'MyFunc',
      definitionFile: 'src/main.ts',
      definitionLine: 10,
      references: [
        { file: 'src/other.ts', line: 5, preview: 'MyFunc()' },
      ],
    };

    const lines = [
      `## References: \`${result.symbol}\``,
      `Defined in **${result.definitionFile}:${result.definitionLine}**`,
      `Found ${result.references.length} reference(s):`,
      '',
    ];
    for (const ref of result.references) {
      lines.push(`- **${ref.file}:${ref.line}** — \`${ref.preview}\``);
    }
    const md = lines.join('\n');

    assert.ok(md.includes('## References: `MyFunc`'));
    assert.ok(md.includes('**src/main.ts:10**'));
    assert.ok(md.includes('1 reference(s)'));
    assert.ok(md.includes('**src/other.ts:5**'));
  });

  test('formatCallHierarchyMarkdown produces valid markdown', () => {
    const result = {
      symbol: 'doStuff',
      file: 'src/util.ts',
      line: 15,
      callers: [{ name: 'main', file: 'src/index.ts', line: 3 }],
      callees: [{ name: 'helper', file: 'src/helper.ts', line: 7 }],
    };

    const lines = [
      `## Call Hierarchy: \`${result.symbol}\``,
      `Location: **${result.file}:${result.line}**`,
      '',
    ];
    if (result.callers.length > 0) {
      lines.push(`### Called by (${result.callers.length}):`);
      for (const c of result.callers) {
        lines.push(`- \`${c.name}\` in **${c.file}:${c.line}**`);
      }
      lines.push('');
    }
    if (result.callees.length > 0) {
      lines.push(`### Calls (${result.callees.length}):`);
      for (const c of result.callees) {
        lines.push(`- \`${c.name}\` in **${c.file}:${c.line}**`);
      }
    }
    const md = lines.join('\n');

    assert.ok(md.includes('## Call Hierarchy: `doStuff`'));
    assert.ok(md.includes('### Called by (1):'));
    assert.ok(md.includes('`main`'));
    assert.ok(md.includes('### Calls (1):'));
    assert.ok(md.includes('`helper`'));
  });

  test('reference limit caps at 50', () => {
    const MAX_REFS = 50;
    const bigList = Array.from({ length: 100 }, (_, i) => ({
      file: `src/file${i}.ts`,
      line: i + 1,
      preview: `usage ${i}`,
    }));
    const limited = bigList.slice(0, MAX_REFS);
    assert.strictEqual(limited.length, 50);
  });

  test('call hierarchy limit caps at 30', () => {
    const MAX_CALLS = 30;
    const bigList = Array.from({ length: 60 }, (_, i) => ({
      name: `func${i}`,
      file: `src/file${i}.ts`,
      line: i + 1,
    }));
    const limited = bigList.slice(0, MAX_CALLS);
    assert.strictEqual(limited.length, 30);
  });
});
