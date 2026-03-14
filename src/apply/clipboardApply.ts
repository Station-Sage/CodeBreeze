import * as vscode from 'vscode';
import { parseClipboard } from './markdownParser';
import { detectContentType } from './diffDetector';
import { applyPatch } from './patchApplier';
import { resolveOrCreateFile } from './fileMatcher';
import { createUndoPoint } from './safetyGuard';
import { ApplyResult, CodeBlock } from '../types';

export async function applyFromClipboard(): Promise<void> {
  const text = await vscode.env.clipboard.readText();
  if (!text.trim()) {
    vscode.window.showInformationMessage('CodeBreeze: Clipboard is empty');
    return;
  }

  const contentType = detectContentType(text);

  if (contentType === 'diff') {
    await applyPatch(text);
    return;
  }

  if (contentType === 'mixed') {
    const choice = await vscode.window.showQuickPick(['Apply as diff patch', 'Apply code blocks'], {
      placeHolder: 'Clipboard contains both diff and code blocks - how to apply?',
    });
    if (!choice) return;
    if (choice === 'Apply as diff patch') {
      await applyPatch(text);
      return;
    }
  }

  const blocks = parseClipboard(text);
  if (blocks.length === 0) {
    vscode.window.showInformationMessage('CodeBreeze: No code blocks found in clipboard');
    return;
  }

  await applyCodeBlocks(blocks);
}

async function applyCodeBlocks(blocks: CodeBlock[]): Promise<void> {
  if (blocks.length === 1) {
    await applySingleBlock(blocks[0]);
    return;
  }

  // Multiple blocks - show QuickPick
  const items = blocks.map((b, i) => ({
    label: b.filePath || `Block ${i + 1} (${b.language || 'unknown'})`,
    description: `${b.content.split('\n').length} lines`,
    picked: true,
    block: b,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select code blocks to apply',
    canPickMany: true,
  });

  if (!selected || selected.length === 0) return;

  await createUndoPoint();

  const results: ApplyResult[] = [];
  for (const item of selected) {
    const result = await applyBlock(item.block);
    results.push(result);
  }

  showApplySummary(results);
}

async function applySingleBlock(block: CodeBlock): Promise<void> {
  if (block.isDiff) {
    await applyPatch(block.content);
    return;
  }

  const uri = await resolveOrCreateFile(block.filePath || '');
  if (!uri) return;

  await createUndoPoint();
  const result = await applyBlock(block, uri);
  showApplySummary([result]);
}

async function applyBlock(block: CodeBlock, uri?: vscode.Uri): Promise<ApplyResult> {
  const targetUri = uri || (block.filePath ? await resolveOrCreateFile(block.filePath) : null);
  const label = block.filePath || 'unknown';

  if (!targetUri) {
    return { filePath: label, status: 'skipped' };
  }

  try {
    if (block.isDiff) {
      const success = await applyPatch(block.content);
      return { filePath: label, status: success ? 'applied' : 'failed' };
    }

    const doc = await vscode.workspace.openTextDocument(targetUri);
    const editor = await vscode.window.showTextDocument(doc, { preview: true });

    // Show diff before applying
    const fullRange = new vscode.Range(
      new vscode.Position(0, 0),
      new vscode.Position(doc.lineCount, 0)
    );

    const choice = await vscode.window.showInformationMessage(
      `Apply ${block.content.split('\n').length} lines to ${vscode.workspace.asRelativePath(targetUri)}?`,
      'Apply',
      'Skip'
    );

    if (choice !== 'Apply') {
      return { filePath: label, status: 'skipped' };
    }

    await editor.edit((editBuilder) => {
      editBuilder.replace(fullRange, block.content);
    });

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

function showApplySummary(results: ApplyResult[]): void {
  const applied = results.filter((r) => r.status === 'applied').length;
  const created = results.filter((r) => r.status === 'created').length;
  const failed = results.filter((r) => r.status === 'failed').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;

  const parts: string[] = [];
  if (applied > 0) parts.push(`${applied} applied`);
  if (created > 0) parts.push(`${created} created`);
  if (skipped > 0) parts.push(`${skipped} skipped`);
  if (failed > 0) parts.push(`${failed} failed`);

  const msg = `CodeBreeze: ${parts.join(', ')}`;
  if (failed > 0) {
    vscode.window.showWarningMessage(msg);
  } else {
    vscode.window.showInformationMessage(msg);
  }
}
