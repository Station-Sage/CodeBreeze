import * as fs from 'fs';
import { diffLines } from 'diff';
import { findWorkspaceFile } from './fileMatcher';
import { CodeBlock } from '../types';

export interface DiffLine {
  type: 'context' | 'added' | 'removed';
  content: string;
  lineNo?: number;
}

export interface BlockDiff {
  filePath: string;
  exists: boolean;
  lines: DiffLine[];
  truncated: boolean;
}

function computeInlineDiff(original: string, proposed: string): DiffLine[] {
  const changes = diffLines(original, proposed);
  const raw: DiffLine[] = [];
  let lineNo = 1;

  for (const change of changes) {
    const lines = change.value.split('\n');
    // diffLines may add a trailing empty string from split — remove it
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

  return collapseContext(raw, 3);
}

function collapseContext(lines: DiffLine[], ctx: number): DiffLine[] {
  const changed = new Set<number>();
  lines.forEach((l, i) => { if (l.type !== 'context') changed.add(i); });
  if (changed.size === 0) return [];

  const keep = new Set<number>();
  for (const i of changed) {
    for (let j = Math.max(0, i - ctx); j <= Math.min(lines.length - 1, i + ctx); j++) {
      keep.add(j);
    }
  }

  const result: DiffLine[] = [];
  let prev = -2;
  const sorted = [...keep].sort((a, b) => a - b);
  for (const i of sorted) {
    if (i > prev + 1) result.push({ type: 'context', content: '...' });
    result.push(lines[i]);
    prev = i;
  }
  return result;
}

export async function previewCodeBlock(block: CodeBlock): Promise<BlockDiff | null> {
  if (!block.filePath) return null;

  const uri = await findWorkspaceFile(block.filePath);

  if (!uri) {
    const lines = block.content.split('\n').map((l) => ({ type: 'added' as const, content: l }));
    return {
      filePath: block.filePath,
      exists: false,
      lines: lines.slice(0, 100),
      truncated: lines.length > 100,
    };
  }

  let original = '';
  try {
    original = fs.readFileSync(uri.fsPath, 'utf8');
  } catch {
    original = '';
  }

  const diffLines2 = computeInlineDiff(original, block.content);
  return {
    filePath: block.filePath,
    exists: true,
    lines: diffLines2,
    truncated: false,
  };
}
