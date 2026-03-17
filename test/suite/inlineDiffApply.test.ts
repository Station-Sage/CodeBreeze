import * as assert from 'assert';
import { computeDiffRanges } from '../../src/apply/diffRangeCalculator';

suite('inlineDiffApply — computeDiffRanges', () => {

  test('no changes returns empty ranges', () => {
    const original = 'line 1\nline 2\nline 3\n';
    const proposed = 'line 1\nline 2\nline 3\n';
    const ranges = computeDiffRanges(original, proposed);
    assert.strictEqual(ranges.length, 0);
  });

  test('single line change produces one range', () => {
    const original = 'line 1\nline 2\nline 3\n';
    const proposed = 'line 1\nline 2 modified\nline 3\n';
    const ranges = computeDiffRanges(original, proposed);
    assert.strictEqual(ranges.length, 1);
    assert.strictEqual(ranges[0].removeCount, 1);
    assert.deepStrictEqual(ranges[0].insertLines, ['line 2 modified']);
  });

  test('added lines at end', () => {
    const original = 'line 1\nline 2\n';
    const proposed = 'line 1\nline 2\nline 3\nline 4\n';
    const ranges = computeDiffRanges(original, proposed);
    assert.strictEqual(ranges.length, 1);
    assert.strictEqual(ranges[0].removeCount, 0);
    assert.ok(ranges[0].insertLines.includes('line 3'));
    assert.ok(ranges[0].insertLines.includes('line 4'));
  });

  test('removed lines produce range with no insertions', () => {
    const original = 'line 1\nline 2\nline 3\nline 4\n';
    const proposed = 'line 1\nline 4\n';
    const ranges = computeDiffRanges(original, proposed);
    assert.ok(ranges.length >= 1);
    // Total lines removed should be 2
    const totalRemoved = ranges.reduce((sum, r) => sum + r.removeCount, 0);
    assert.ok(totalRemoved >= 2);
  });

  test('multiple separate changes produce multiple ranges', () => {
    const original = [
      'line 1',
      'line 2',
      'line 3',
      'line 4',
      'line 5',
      'line 6',
      'line 7',
      '',
    ].join('\n');
    const proposed = [
      'line 1',
      'line 2 changed',
      'line 3',
      'line 4',
      'line 5',
      'line 6 changed',
      'line 7',
      '',
    ].join('\n');
    const ranges = computeDiffRanges(original, proposed);
    assert.strictEqual(ranges.length, 2);
  });

  test('complete replacement of file content', () => {
    const original = 'old content\nold line 2\n';
    const proposed = 'new content\nnew line 2\nnew line 3\n';
    const ranges = computeDiffRanges(original, proposed);
    assert.ok(ranges.length >= 1);
    const totalInserted = ranges.reduce((sum, r) => sum + r.insertLines.length, 0);
    assert.ok(totalInserted >= 3);
  });

  test('empty original produces insertion range', () => {
    const original = '';
    const proposed = 'new line 1\nnew line 2\n';
    const ranges = computeDiffRanges(original, proposed);
    assert.ok(ranges.length >= 1);
    assert.strictEqual(ranges[0].removeCount, 0);
  });

  test('startLine is correct for mid-file changes', () => {
    const original = 'a\nb\nc\nd\ne\n';
    const proposed = 'a\nb\nC\nd\ne\n';
    const ranges = computeDiffRanges(original, proposed);
    assert.strictEqual(ranges.length, 1);
    // 'c' is on line index 2 (0-based)
    assert.strictEqual(ranges[0].startLine, 2);
    assert.strictEqual(ranges[0].removeCount, 1);
    assert.deepStrictEqual(ranges[0].insertLines, ['C']);
  });
});
