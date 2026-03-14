import * as assert from 'assert';
import { parseClipboard, detectDiff } from '../../src/apply/markdownParser';

suite('MarkdownParser Tests', () => {
  test('parse single code block with inline filepath', () => {
    const text = '```typescript:src/app.ts\nconsole.log("hello");\n```';
    const blocks = parseClipboard(text);
    assert.strictEqual(blocks.length, 1);
    assert.strictEqual(blocks[0].filePath, 'src/app.ts');
    assert.strictEqual(blocks[0].language, 'typescript');
    assert.ok(blocks[0].content.includes('console.log'));
  });

  test('parse code block with comment filepath', () => {
    const text = '// filepath: src/utils.ts\n```javascript\nconst x = 1;\n```';
    const blocks = parseClipboard(text);
    assert.strictEqual(blocks.length, 1);
    assert.strictEqual(blocks[0].filePath, 'src/utils.ts');
  });

  test('parse multiple code blocks', () => {
    const text = [
      '```typescript:src/a.ts',
      'const a = 1;',
      '```',
      '',
      '```python:src/b.py',
      'x = 1',
      '```',
    ].join('\n');
    const blocks = parseClipboard(text);
    assert.strictEqual(blocks.length, 2);
    assert.strictEqual(blocks[0].filePath, 'src/a.ts');
    assert.strictEqual(blocks[1].filePath, 'src/b.py');
  });

  test('detect diff content', () => {
    const diffContent = '--- a/src/app.ts\n+++ b/src/app.ts\n@@ -1,3 +1,4 @@\n const x = 1;\n';
    assert.ok(detectDiff(diffContent));
  });

  test('return null filePath when no path present', () => {
    const text = '```typescript\nconst x = 1;\n```';
    const blocks = parseClipboard(text);
    assert.strictEqual(blocks.length, 1);
    assert.strictEqual(blocks[0].filePath, null);
  });

  test('handle empty clipboard', () => {
    assert.deepStrictEqual(parseClipboard(''), []);
    assert.deepStrictEqual(parseClipboard('   '), []);
  });
});
