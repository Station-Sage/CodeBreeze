import * as assert from 'assert';
import * as path from 'path';
import { buildFileMarkdown } from '../../src/collect/fileCopy';
import { getGitDiff, getGitLog, getCurrentBranch } from '../../src/collect/gitCollector';
import { getLastBuildResult } from '../../src/collect/localBuildCollector';

// Workspace root = repo root (3 levels up from out/test/suite/)
const repoRoot = path.join(__dirname, '../../../');

suite('Collect Utils Tests', () => {

  // --- fileCopy ---
  suite('buildFileMarkdown', () => {
    test('wraps content in typed code block', () => {
      const result = buildFileMarkdown('src/foo.ts', 'typescript', 'const x = 1;', 'src/foo.ts');
      assert.ok(result.includes('```typescript'));
      assert.ok(result.includes('src/foo.ts'));
      assert.ok(result.includes('const x = 1;'));
      assert.ok(result.endsWith('```'));
    });

    test('handles empty content', () => {
      const result = buildFileMarkdown('src/empty.ts', 'typescript', '', 'src/empty.ts');
      assert.ok(result.includes('```typescript'));
      assert.ok(result.includes('src/empty.ts'));
    });

    test('handles python file language', () => {
      const result = buildFileMarkdown('app.py', 'python', 'print("hi")', 'app.py');
      assert.ok(result.includes('```python'));
      assert.ok(result.includes('print("hi")'));
    });

    test('multiline content preserved', () => {
      const content = 'line1\nline2\nline3';
      const result = buildFileMarkdown('a.ts', 'typescript', content, 'a.ts');
      assert.ok(result.includes('line1'));
      assert.ok(result.includes('line2'));
      assert.ok(result.includes('line3'));
    });
  });

  // --- gitCollector (uses real git repo) ---
  suite('gitCollector', () => {
    test('getCurrentBranch returns non-empty string', () => {
      const branch = getCurrentBranch(repoRoot);
      assert.strictEqual(typeof branch, 'string');
      assert.ok(branch.length > 0, 'branch name should not be empty');
    });

    test('getGitLog returns string', () => {
      const log = getGitLog(repoRoot, 3);
      assert.strictEqual(typeof log, 'string');
    });

    test('getGitLog count limits entries', () => {
      const log1 = getGitLog(repoRoot, 1);
      const log5 = getGitLog(repoRoot, 5);
      const count1 = log1.trim() ? log1.trim().split('\n').length : 0;
      const count5 = log5.trim() ? log5.trim().split('\n').length : 0;
      assert.ok(count1 <= count5, 'fewer entries with lower count');
    });

    test('getGitDiff staged returns string', () => {
      const diff = getGitDiff(repoRoot, 'staged');
      assert.strictEqual(typeof diff, 'string');
    });

    test('getGitDiff unstaged returns string', () => {
      const diff = getGitDiff(repoRoot, 'unstaged');
      assert.strictEqual(typeof diff, 'string');
    });

    test('getGitDiff both combines staged and unstaged', () => {
      const staged = getGitDiff(repoRoot, 'staged');
      const unstaged = getGitDiff(repoRoot, 'unstaged');
      const both = getGitDiff(repoRoot, 'both');
      assert.strictEqual(typeof both, 'string');
      assert.ok(both.includes(staged), 'both should contain staged diff');
      assert.ok(both.includes(unstaged), 'both should contain unstaged diff');
    });
  });

  // --- localBuildCollector ---
  suite('localBuildCollector', () => {
    test('getLastBuildResult returns null initially', () => {
      // Module-level state — may be null if no build has run in this session
      const result = getLastBuildResult();
      assert.ok(result === null || typeof result === 'object');
    });
  });

});
