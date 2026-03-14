import * as assert from 'assert';
import { detectContentType } from '../../src/apply/diffDetector';

suite('DiffDetector Tests', () => {
  test('detect unified diff', () => {
    const diff = '--- a/src/app.ts\n+++ b/src/app.ts\n@@ -1,3 +1,4 @@\n const x = 1;\n';
    assert.strictEqual(detectContentType(diff), 'diff');
  });

  test('detect code block', () => {
    const code = '```typescript:src/app.ts\nconst x = 1;\n```';
    assert.strictEqual(detectContentType(code), 'codeblock');
  });

  test('detect mixed content', () => {
    const mixed = '--- a/src/app.ts\n+++ b/src/app.ts\n@@ -1 +1 @@\n\n```typescript\nconst x = 1;\n```';
    assert.strictEqual(detectContentType(mixed), 'mixed');
  });

  test('detect plain text', () => {
    assert.strictEqual(detectContentType('Hello world'), 'plain');
    assert.strictEqual(detectContentType(''), 'plain');
  });

  test('detect git diff format', () => {
    const gitDiff = 'diff --git a/src/app.ts b/src/app.ts\nindex abc..def 100644\n--- a/src/app.ts\n+++ b/src/app.ts\n@@ -1 +1 @@\n-old\n+new\n';
    assert.strictEqual(detectContentType(gitDiff), 'diff');
  });
});
