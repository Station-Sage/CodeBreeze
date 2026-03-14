import * as assert from 'assert';
import type {
  CodeBlock,
  ApplyResult,
  HistoryEntry,
  BuildResult,
  ParsedError,
  ContextPayload,
  MonitorEvent,
} from '../../src/types';

suite('Types Interface Tests', () => {
  test('CodeBlock with filePath', () => {
    const block: CodeBlock = {
      language: 'typescript',
      filePath: 'src/app.ts',
      content: 'const x = 1;',
      isDiff: false,
    };
    assert.strictEqual(block.language, 'typescript');
    assert.strictEqual(block.filePath, 'src/app.ts');
    assert.strictEqual(block.isDiff, false);
  });

  test('CodeBlock with null filePath', () => {
    const block: CodeBlock = {
      language: 'javascript',
      filePath: null,
      content: 'let y = 2;',
      isDiff: false,
    };
    assert.strictEqual(block.filePath, null);
  });

  test('ApplyResult all status values', () => {
    const results: ApplyResult[] = [
      { filePath: 'a.ts', status: 'applied' },
      { filePath: 'b.ts', status: 'created' },
      { filePath: 'c.ts', status: 'skipped' },
      { filePath: 'd.ts', status: 'failed', error: 'not found' },
    ];
    assert.strictEqual(results.length, 4);
    assert.strictEqual(results[3].error, 'not found');
    assert.strictEqual(results[0].error, undefined);
  });

  test('HistoryEntry with stashRef', () => {
    const entry: HistoryEntry = {
      id: 'test-123',
      timestamp: Date.now(),
      results: [{ filePath: 'x.ts', status: 'applied' }],
      undoAvailable: true,
      stashRef: 'stash@{0}',
    };
    assert.strictEqual(entry.results.length, 1);
    assert.strictEqual(entry.stashRef, 'stash@{0}');
  });

  test('BuildResult with ParsedError', () => {
    const err: ParsedError = {
      filePath: 'src/app.ts',
      line: 42,
      column: 10,
      message: 'Type error',
      severity: 'error',
      codeContext: 'const x: number = "str";',
    };
    const build: BuildResult = {
      command: 'npm run compile',
      exitCode: 1,
      stdout: '',
      stderr: 'error TS2322',
      duration: 5000,
      errors: [err],
      timestamp: Date.now(),
    };
    assert.strictEqual(build.errors[0].line, 42);
    assert.strictEqual(build.errors[0].severity, 'error');
  });

  test('ContextPayload all types', () => {
    const types: ContextPayload['type'][] = [
      'file', 'selection', 'errors', 'gitDiff', 'gitLog', 'buildLog', 'smartContext',
    ];
    types.forEach((t) => {
      const p: ContextPayload = { type: t, content: 'test', label: t };
      assert.strictEqual(p.type, t);
    });
  });

  test('MonitorEvent structure', () => {
    const event: MonitorEvent = {
      source: 'terminal',
      type: 'error',
      data: { message: 'failed' },
      timestamp: Date.now(),
    };
    assert.strictEqual(event.source, 'terminal');
    assert.strictEqual(event.type, 'error');
  });
});
