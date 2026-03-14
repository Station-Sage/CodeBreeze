import * as assert from 'assert';
import { parseClipboard, detectDiff } from '../../src/apply/markdownParser';

suite('MarkdownParser Extended Tests', () => {
  test('parse code block with # file: comment', () => {
    const text = '# file: src/index.ts\n```typescript\nconst x = 1;\n```';
    const blocks = parseClipboard(text);
    assert.strictEqual(blocks.length, 1);
    assert.strictEqual(blocks[0].filePath, 'src/index.ts');
  });

  test('parse block with template literal inside', () => {
    const text = '```typescript:src/test.ts\nconst s = `hello ${name}`;\n```';
    const blocks = parseClipboard(text);
    assert.strictEqual(blocks.length, 1);
    assert.ok(blocks[0].content.includes('`hello ${name}`'));
  });

  test('parse block with windows-style backslash path', () => {
    const text = '```typescript:src\\utils\\helper.ts\nconst x = 1;\n```';
    const blocks = parseClipboard(text);
    assert.strictEqual(blocks.length, 1);
    assert.ok(blocks[0].filePath !== null);
    assert.ok(blocks[0].filePath!.includes('helper.ts'));
  });

  test('parse block with URL in content', () => {
    const text = '```javascript:src/api.js\nconst url = "https://example.com?a=1&b=2";\n```';
    const blocks = parseClipboard(text);
    assert.strictEqual(blocks.length, 1);
    assert.ok(blocks[0].content.includes('https://example.com'));
  });

  test('handle large content (500 lines)', () => {
    const longContent = Array.from({ length: 500 }, (_, i) => `const v${i} = ${i};`).join('\n');
    const text = '```typescript:src/big.ts\n' + longContent + '\n```';
    const blocks = parseClipboard(text);
    assert.strictEqual(blocks.length, 1);
    assert.ok(blocks[0].content.split('\n').length >= 500);
  });

  test('detectDiff false for code block', () => {
    assert.strictEqual(detectDiff('const x = 1;\nconst y = 2;'), false);
  });

  test('detectDiff true for unified diff', () => {
    const diff = '--- a/file.ts\n+++ b/file.ts\n@@ -1 +1 @@\n-old\n+new';
    assert.strictEqual(detectDiff(diff), true);
  });

  test('multiple blocks preserve order', () => {
    const text = [
      '```typescript:src/first.ts',
      'const a = 1;',
      '```',
      '',
      '```python:src/second.py',
      'x = 2',
      '```',
      '',
      '```rust:src/third.rs',
      'fn main() {}',
      '```',
    ].join('\n');
    const blocks = parseClipboard(text);
    assert.strictEqual(blocks.length, 3);
    assert.strictEqual(blocks[0].filePath, 'src/first.ts');
    assert.strictEqual(blocks[1].filePath, 'src/second.py');
    assert.strictEqual(blocks[2].filePath, 'src/third.rs');
  });

  test('parse block with c++ language', () => {
    const text = '```c++:src/main.cpp\nint main() { return 0; }\n```';
    const blocks = parseClipboard(text);
    assert.strictEqual(blocks.length, 1);
    assert.strictEqual(blocks[0].language, 'c++');
    assert.strictEqual(blocks[0].filePath, 'src/main.cpp');
  });
});
