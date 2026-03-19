/**
 * Native Diff Preview — Phase 8-1
 *
 * Uses VS Code's built-in diff editor (vscode.diff command)
 * to show before/after comparison with Accept/Reject actions.
 */
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { CodeBlock } from '../types';
import { findWorkspaceFile, resolveOrCreateFile } from './fileMatcher';
import { getWorkspaceRoot } from '../config';

const PENDING_SUFFIX = '.codebreeze-pending';
const pendingFiles = new Map<string, vscode.Uri>();

/**
 * Show native VS Code diff editor for a single code block.
 * Creates a temporary pending file and opens vscode.diff.
 * Returns true if user accepted, false if rejected/cancelled.
 */
export async function showNativeDiff(block: CodeBlock): Promise<boolean> {
  if (!block.filePath) return false;

  const originalUri = await findWorkspaceFile(block.filePath);
  const wsRoot = getWorkspaceRoot() || '';

  // For new files, create a blank original
  const isNewFile = !originalUri;
  const actualOriginalUri = originalUri || vscode.Uri.file(path.join(wsRoot, block.filePath));

  // Write pending content to temp file
  const pendingPath = actualOriginalUri.fsPath + PENDING_SUFFIX;
  fs.writeFileSync(pendingPath, block.content, 'utf8');
  const pendingUri = vscode.Uri.file(pendingPath);
  pendingFiles.set(pendingPath, actualOriginalUri);

  const relPath = path.relative(wsRoot, actualOriginalUri.fsPath);
  const title = isNewFile ? `${relPath} (New File)` : `${relPath}: Current ↔ Proposed`;

  // If new file, create empty temp original
  let leftUri = actualOriginalUri;
  if (isNewFile) {
    const emptyPath = actualOriginalUri.fsPath + '.codebreeze-empty';
    fs.writeFileSync(emptyPath, '', 'utf8');
    leftUri = vscode.Uri.file(emptyPath);
  }

  await vscode.commands.executeCommand('vscode.diff', leftUri, pendingUri, title);

  // Show accept/reject prompt
  const choice = await vscode.window.showInformationMessage(
    `Apply changes to ${relPath}?`,
    { modal: false },
    'Accept',
    'Reject'
  );

  // Clean up temp files
  cleanupPendingFile(pendingPath);
  if (isNewFile) {
    try {
      fs.unlinkSync(leftUri.fsPath);
    } catch {
      /* ignore */
    }
  }

  if (choice === 'Accept') {
    return true;
  }

  return false;
}

/**
 * Show native diff for multiple code blocks.
 * Opens QuickPick to select files, then opens diff tabs for each.
 * Returns list of accepted block indices.
 */
export async function showMultiFileDiff(blocks: CodeBlock[]): Promise<number[]> {
  const items = blocks
    .map((b, i) => ({
      label: b.filePath || `Block ${i + 1}`,
      description: `${b.content.split('\n').length} lines`,
      picked: true,
      index: i,
    }))
    .filter((item) => blocks[item.index].filePath);

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select files to preview diff',
    canPickMany: true,
  });

  if (!selected || selected.length === 0) return [];

  const accepted: number[] = [];
  for (const item of selected) {
    const block = blocks[item.index];
    const wasAccepted = await showNativeDiff(block);
    if (wasAccepted) {
      accepted.push(item.index);
    }
  }

  return accepted;
}

/**
 * Apply code block through native diff preview.
 * If user accepts, writes the content to the file.
 */
export async function applyWithNativeDiff(block: CodeBlock): Promise<boolean> {
  const accepted = await showNativeDiff(block);
  if (!accepted || !block.filePath) return false;

  const uri = await resolveOrCreateFile(block.filePath);
  if (!uri) return false;

  const doc = await vscode.workspace.openTextDocument(uri);
  const edit = new vscode.WorkspaceEdit();
  const fullRange = new vscode.Range(
    new vscode.Position(0, 0),
    new vscode.Position(doc.lineCount, 0)
  );
  edit.replace(uri, fullRange, block.content);
  await vscode.workspace.applyEdit(edit);
  await doc.save();

  return true;
}

function cleanupPendingFile(pendingPath: string): void {
  try {
    fs.unlinkSync(pendingPath);
  } catch {
    /* ignore */
  }
  pendingFiles.delete(pendingPath);
}

/** Clean up all pending files (call on deactivate) */
export function cleanupAllPending(): void {
  for (const pendingPath of pendingFiles.keys()) {
    cleanupPendingFile(pendingPath);
  }
}
