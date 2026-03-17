import * as vscode from 'vscode';
import { getWorkspaceRoot } from '../config';
import { execSync } from '../utils/exec';

export interface UndoPoint {
  type: 'git_stash' | 'workspace_edit';
  stashRef?: string;
  timestamp: number;
}

let lastUndoPoint: UndoPoint | null = null;

export async function createUndoPoint(): Promise<UndoPoint | null> {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) return null;

  try {
    // Try git stash
    const status = execSync('git status --porcelain', workspaceRoot);
    if (status.trim()) {
      execSync('git stash push -m "codebreeze-before-apply"', workspaceRoot);
      const stashRef = 'stash@{0}';
      lastUndoPoint = { type: 'git_stash', stashRef, timestamp: Date.now() };
      return lastUndoPoint;
    }
  } catch (err) {
    console.warn('[CodeBreeze] git stash failed:', err);
  }

  lastUndoPoint = { type: 'workspace_edit', timestamp: Date.now() };
  return lastUndoPoint;
}

export async function undoLastApply(): Promise<boolean> {
  if (!lastUndoPoint) {
    vscode.window.showInformationMessage('CodeBreeze: No undo point available');
    return false;
  }

  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) return false;

  if (lastUndoPoint.type === 'git_stash' && lastUndoPoint.stashRef) {
    try {
      execSync(`git stash pop ${lastUndoPoint.stashRef}`, workspaceRoot);
      vscode.window.showInformationMessage('CodeBreeze: Reverted to pre-apply state via git stash');
      lastUndoPoint = null;
      return true;
    } catch (err) {
      vscode.window.showErrorMessage(
        `CodeBreeze: Could not undo: ${err instanceof Error ? err.message : String(err)}`
      );
      return false;
    }
  }

  // For workspace_edit type, use VS Code's undo (affects all open files)
  await vscode.commands.executeCommand('workbench.action.files.revert');
  vscode.window.showInformationMessage(
    'CodeBreeze: Files reverted (all open files affected — no git undo available)'
  );
  lastUndoPoint = null;
  return true;
}
