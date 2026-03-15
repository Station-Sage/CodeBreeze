import * as assert from 'assert';
import { diffLines } from 'diff';

// Pure unit tests for diff preview logic using the 'diff' package.

interface DiffLine {
  type: 'context' | 'added' | 'removed';
  content: string;
  lineNo?: number;
}

function computeInlineDiff(original: string, proposed: string): DiffLine[] {
  const changes = diffLines(original, proposed);
  const raw: DiffLine[] = [];
  let lineNo = 1;

  for (const change of changes) {
    const lines = change.value.split('\n');
    if (lines[lines.length - 1] === '') lines.pop();

    for (const content of lines) {
      if (change.added) {
        raw.push({ type: 'added', content });
      } else if (change.removed) {
        raw.push({ type: 'removed', content, lineNo: lineNo++ });
      } else {
        raw.push({ type: 'context', content, lineNo: lineNo++ });
      }
    }
  }
  return raw;
}

function computeCollapsed(original: string, proposed: string): DiffLine[] {
  const all = computeInlineDiff(original, proposed);
  const changed = new Set<number>();
  all.forEach((l, i) => { if (l.type !== 'context') changed.add(i); });
  if (changed.size === 0) return [];

  const ctx = 3;
  const keep = new Set<number>();
  for (const i of changed) {
    for (let j = Math.max(0, i - ctx); j <= Math.min(all.length - 1, i + ctx); j++) keep.add(j);
  }

  const result: DiffLine[] = [];
  let prev = -2;
  for (const i of [...keep].sort((a, b) => a - b)) {
    if (i > prev + 1) result.push({ type: 'context', content: '...' });
    result.push(all[i]);
    prev = i;
  }
  return result;
}

suite('DiffPreview Tests', () => {
  test('identical content produces empty collapsed diff', () => {
    const src = 'line1\nline2\nline3';
    const diff = computeCollapsed(src, src);
    // No changes → collapseContext returns []
    assert.strictEqual(diff.length, 0, 'no diff for identical content');
  });

  test('identical content raw diff is all context', () => {
    const src = 'line1\nline2\nline3';
    const diff = computeInlineDiff(src, src);
    assert.ok(diff.every((l) => l.type === 'context'), 'all context for identical');
  });

  test('added line shows as added', () => {
    const orig = 'line1\nline2';
    const next = 'line1\nnew line\nline2';
    const diff = computeInlineDiff(orig, next);
    const added = diff.filter((l) => l.type === 'added');
    assert.ok(added.length >= 1, 'has added line');
    assert.ok(added.some((l) => l.content === 'new line'), 'new line present');
  });

  test('removed line shows as removed', () => {
    const orig = 'line1\nold line\nline2';
    const next = 'line1\nline2';
    const diff = computeInlineDiff(orig, next);
    const removed = diff.filter((l) => l.type === 'removed');
    assert.ok(removed.length >= 1, 'has removed line');
    assert.ok(removed.some((l) => l.content === 'old line'), 'old line present');
  });

  test('modified line shows as remove + add', () => {
    const orig = 'const x = 1;';
    const next = 'const x = 2;';
    const diff = computeInlineDiff(orig, next);
    assert.ok(diff.some((l) => l.type === 'removed'), 'has removal');
    assert.ok(diff.some((l) => l.type === 'added'), 'has addition');
  });

  test('empty original = all added', () => {
    const diff = computeInlineDiff('', 'hello\nworld');
    const added = diff.filter((l) => l.type === 'added');
    assert.ok(added.length >= 1, 'has added lines for new file');
  });

  test('empty proposed = all removed', () => {
    const diff = computeInlineDiff('hello\nworld', '');
    const removed = diff.filter((l) => l.type === 'removed');
    assert.ok(removed.length >= 1, 'all removed for emptied file');
  });

  test('lineNo is set on context and removed lines', () => {
    const orig = 'a\nb\nc';
    const next = 'a\nB\nc';
    const diff = computeInlineDiff(orig, next);
    const context = diff.filter((l) => l.type === 'context');
    assert.ok(context.every((l) => l.lineNo !== undefined), 'context lines have lineNo');
    const removed = diff.filter((l) => l.type === 'removed');
    assert.ok(removed.every((l) => l.lineNo !== undefined), 'removed lines have lineNo');
  });

  test('multiple changes tracked correctly', () => {
    const orig = ['line1', 'remove_me', 'line3', 'line4', 'also_remove'].join('\n');
    const next = ['line1', 'line3', 'added_line', 'line4'].join('\n');
    const diff = computeInlineDiff(orig, next);
    const removed = diff.filter((l) => l.type === 'removed').map((l) => l.content);
    const added = diff.filter((l) => l.type === 'added').map((l) => l.content);
    assert.ok(removed.includes('remove_me'), 'remove_me detected');
    assert.ok(removed.includes('also_remove'), 'also_remove detected');
    assert.ok(added.includes('added_line'), 'added_line detected');
  });

  test('collapsed diff includes ellipsis for far-apart changes', () => {
    // 20 context lines between two changes
    const origLines = Array.from({ length: 25 }, (_, i) => `line${i + 1}`);
    origLines[2] = 'changed_early';   // change at idx 2
    origLines[22] = 'changed_late';   // change at idx 22
    const newLines = [...origLines];
    newLines[2] = 'NEW_early';
    newLines[22] = 'NEW_late';
    const diff = computeCollapsed(origLines.join('\n'), newLines.join('\n'));
    const ellipsis = diff.filter((l) => l.content === '...');
    assert.ok(ellipsis.length > 0, 'has ellipsis separator');
  });
});
