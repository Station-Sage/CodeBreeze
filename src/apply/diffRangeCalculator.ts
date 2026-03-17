// src/apply/diffRangeCalculator.ts
// Pure diff range calculation — no vscode dependency, testable standalone.

import { diffLines, Change } from 'diff';

export interface DiffRange {
  /** 0-based start line in original file */
  startLine: number;
  /** Number of lines to remove from original */
  removeCount: number;
  /** Lines to insert */
  insertLines: string[];
}

/**
 * Compute minimal diff ranges between original and proposed content.
 */
export function computeDiffRanges(original: string, proposed: string): DiffRange[] {
  const changes: Change[] = diffLines(original, proposed);
  const ranges: DiffRange[] = [];
  let lineNo = 0;

  let i = 0;
  while (i < changes.length) {
    const change = changes[i];

    if (!change.added && !change.removed) {
      lineNo += (change.count ?? 0);
      i++;
      continue;
    }

    const startLine = lineNo;
    let removeCount = 0;
    const insertLines: string[] = [];

    while (i < changes.length && (changes[i].added || changes[i].removed)) {
      const c = changes[i];
      if (c.removed) {
        removeCount += (c.count ?? 0);
        lineNo += (c.count ?? 0);
      }
      if (c.added) {
        const lines = c.value.split('\n');
        if (lines[lines.length - 1] === '') lines.pop();
        insertLines.push(...lines);
      }
      i++;
    }

    ranges.push({ startLine, removeCount, insertLines });
  }

  return ranges;
}
