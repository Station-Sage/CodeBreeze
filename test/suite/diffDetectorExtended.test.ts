import * as assert from 'assert';
import {
  detectContentType,
  extractDiffPatches,
} from '../../src/apply/diffDetector';

suite('DiffDetector Extended Tests', () => {
  // --- extractDiffPatches ---
  test('extract single diff patch', () => {
    const diff = [
      'diff --git a/src/app.ts b/src/app.ts',
      '--- a/src/app.ts',
      '+++ b/src/app.ts',
      '@@ -1,3 +1,4 @@',
      ' const x = 1;',
      '+const y = 2;',
    ].join('\n');
    const patches = extractDiffPatches(diff);
    assert.strictEqual(patches.length, 1);
    assert.ok(patches[0].includes('src/app.ts'));
  });

  test('extract multiple diff patches', () => {
    const diff = [
      'diff --git a/src/a.ts b/src/a.ts',
      '--- a/src/a.ts',
      '+++ b/src/a.ts',
      '@@ -1 +1 @@',
      '-old',
      '+new',
      'diff --git a/src/b.ts b/src/b.ts',
      '--- a/src/b.ts',
      '+++ b/src/b.ts',
      '@@ -1 +1 @@',
      '-foo',
      '+bar',
    ].join('\n');
    const patches = extractDiffPatches(diff);
    assert.strictEqual(patches.length, 2);
  });

  test('extract patches from empty string', () => {
    const patches = extractDiffPatches('');
    assert.strictEqual(patches.length, 0);
  });

  test('extract patches from non-diff text', () => {
    const patches = extractDiffPatches('just some regular text');
    assert.strictEqual(patches.length, 0);
  });

  // --- detectContentType edge cases ---
  test('whitespace-only is plain', () => {
    assert.strictEqual(detectContentType('   \n  \n  '), 'plain');
  });

  test('code block without filepath is codeblock', () => {
    const text = '```\nsome code\n```';
    assert.strictEqual(detectContentType(text), 'codeblock');
  });

  test('mixed content with both diff and codeblock', () => {
    const text = 'diff --git a/f b/f\n--- a/f\n+++ b/f\n@@ -1 +1 @@\n-a\n+b\n\n```ts\nx\n```';
    assert.strictEqual(detectContentType(text), 'mixed');
  });
});
