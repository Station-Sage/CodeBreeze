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
      // B-020: use unique stash message to avoid positional ref race condition
      const stashTag = `codebreeze-${Date.now()}`;
      execSync(`git stash push -m "${stashTag}"`, workspaceRoot);
      lastUndoPoint = { type: 'git_stash', stashRef: stashTag, timestamp: Date.now() };
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
      // B-020: find stash by unique message tag instead of positional ref
      const stashTag = lastUndoPoint.stashRef;
      const stashList = execSync('git stash list --format=%gd:%s', workspaceRoot);
      const match = stashList.split('\n').find((line) => line.includes(stashTag));
      if (!match) {
        vscode.window.showErrorMessage('CodeBreeze: Stash entry not found — may have been dropped');
        return false;
      }
      const stashIndex = match.split(':')[0]; // e.g. "stash@{2}"
      execSync(`git stash pop ${stashIndex}`, workspaceRoot);
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
