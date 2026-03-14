import * as assert from 'assert';
import {
  formatCodeBlock,
  formatSection,
  truncateLines,
  getLineRange,
} from '../../src/utils/markdown';

suite('Markdown Utils Tests', () => {
  // --- formatCodeBlock ---
  test('formatCodeBlock with language and filePath', () => {
    const result = formatCodeBlock('const x = 1;', 'typescript', 'src/app.ts');
    assert.ok(result.includes('```typescript:src/app.ts'));
    assert.ok(result.includes('const x = 1;'));
    assert.ok(result.endsWith('```'));
  });

  test('formatCodeBlock with language only (no filePath)', () => {
    const result = formatCodeBlock('print("hi")', 'python');
    assert.strictEqual(result, '```python\nprint("hi")\n```');
  });

  test('formatCodeBlock with empty language', () => {
    const result = formatCodeBlock('hello', '');
    assert.strictEqual(result, '```\nhello\n```');
  });

  test('formatCodeBlock with multiline content', () => {
    const content = 'line1\nline2\nline3';
    const result = formatCodeBlock(content, 'ts', 'a.ts');
    assert.ok(result.startsWith('```ts:a.ts\n'));
    assert.ok(result.includes('line1\nline2\nline3'));
  });

  // --- formatSection ---
  test('formatSection creates markdown section', () => {
    const result = formatSection('Title', 'body text');
    assert.strictEqual(result, '## Title\n\nbody text\n');
  });

  test('formatSection with empty content', () => {
    const result = formatSection('Empty', '');
    assert.strictEqual(result, '## Empty\n\n\n');
  });

  // --- truncateLines ---
  test('truncateLines returns full text when under limit', () => {
    const text = 'line1\nline2\nline3';
    const result = truncateLines(text, 10);
    assert.strictEqual(result, text);
  });

  test('truncateLines truncates when over limit', () => {
    const lines = Array.from({ length: 50 }, (_, i) => `line${i + 1}`);
    const text = lines.join('\n');
    const result = truncateLines(text, 10);
    assert.ok(result.includes('line1'));
    assert.ok(result.includes('line50'));
    assert.ok(result.includes('40 lines omitted'));
    const resultLines = result.split('\n');
    assert.strictEqual(resultLines.length, 11); // 5 + 1 omit + 5
  });

  test('truncateLines with exact limit', () => {
    const text = 'a\nb\nc';
    assert.strictEqual(truncateLines(text, 3), text);
  });

  // --- getLineRange ---
  test('getLineRange extracts correct range with line numbers', () => {
    const text = Array.from({ length: 20 }, (_, i) => `content${i + 1}`).join('\n');
    const result = getLineRange(text, 10, 2);
    assert.ok(result.includes('8: content8'));
    assert.ok(result.includes('10: content10'));
    assert.ok(result.includes('12: content12'));
  });

  test('getLineRange at start of file', () => {
    const text = 'first\nsecond\nthird\nfourth\nfifth';
    const result = getLineRange(text, 1, 2);
    assert.ok(result.includes('1: first'));
    assert.ok(result.includes('2: second'));
    assert.ok(result.includes('3: third'));
  });
});
