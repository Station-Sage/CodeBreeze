// src/apply/inlineDiffApply.ts
// Partial-edit apply using diff ranges instead of whole-file replacement.

import * as vscode from 'vscode';
import { resolveOrCreateFile } from './fileMatcher';
import { computeDiffRanges } from './diffRangeCalculator';
import { ApplyResult, CodeBlock } from '../types';

export { computeDiffRanges } from './diffRangeCalculator';

/**
 * Apply code block using inline diff (partial edit).
 * Only replaces changed ranges instead of the entire file.
 */
export async function applyInlineDiff(block: CodeBlock): Promise<ApplyResult> {
  const label = block.filePath || 'unknown';

  if (!block.filePath) {
    return { filePath: label, status: 'skipped', error: 'No file path' };
  }

  const uri = await resolveOrCreateFile(block.filePath);
  if (!uri) {
    return { filePath: label, status: 'skipped', error: 'File not found or creation declined' };
  }

  try {
    const doc = await vscode.workspace.openTextDocument(uri);
    const original = doc.getText();

    // If file is empty (new file), fall back to whole-file write
    if (original.trim() === '') {
      const edit = new vscode.WorkspaceEdit();
      edit.insert(uri, new vscode.Position(0, 0), block.content);
      await vscode.workspace.applyEdit(edit);
      await doc.save();
      return { filePath: label, status: 'created' };
    }

    const ranges = computeDiffRanges(original, block.content);

    if (ranges.length === 0) {
      return { filePath: label, status: 'skipped', error: 'No changes detected' };
    }

    // Apply ranges in reverse order to preserve line numbers
    const edit = new vscode.WorkspaceEdit();
    for (let i = ranges.length - 1; i >= 0; i--) {
      const r = ranges[i];
      const startPos = new vscode.Position(r.startLine, 0);
      const endPos = new vscode.Position(r.startLine + r.removeCount, 0);
      const range = new vscode.Range(startPos, endPos);
      const newText = r.insertLines.length > 0 ? r.insertLines.join('\n') + '\n' : '';
      edit.replace(uri, range, newText);
    }

    await vscode.workspace.applyEdit(edit);
    await doc.save();
    return { filePath: label, status: 'applied' };
  } catch (err) {
    return {
      filePath: label,
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Headless inline diff apply for MCP/agent loop use.
 * No prompts, returns results directly.
 */
export async function applyInlineDiffHeadless(blocks: CodeBlock[]): Promise<ApplyResult[]> {
  const results: ApplyResult[] = [];
  for (const block of blocks) {
    if (block.isDiff) {
      // Diff patches should go through patchApplier
      results.push({
        filePath: block.filePath || 'unknown',
        status: 'skipped',
        error: 'Use patchApplier for diff format',
      });
      continue;
    }
    const result = await applyInlineDiff(block);
    results.push(result);
  }
  return results;
}
