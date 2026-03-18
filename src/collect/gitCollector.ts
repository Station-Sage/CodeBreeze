import * as vscode from 'vscode';
import { execSync } from '../utils/exec';
import { getConfig, getWorkspaceRoot } from '../config';
import { writeClipboard } from '../utils/clipboardCompat';

export async function copyGitDiffForAI(): Promise<void> {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    vscode.window.showErrorMessage('CodeBreeze: No workspace open');
    return;
  }

  const config = getConfig();
  let mode = config.gitDiffMode;

  // Ask user if not set to a fixed mode
  const choice = await vscode.window.showQuickPick(
    [
      { label: 'Unstaged changes', value: 'unstaged' },
      { label: 'Staged changes', value: 'staged' },
      { label: 'Both (staged + unstaged)', value: 'both' },
    ],
    { placeHolder: 'Select git diff mode' }
  );

  if (!choice) return;
  mode = choice.value as 'staged' | 'unstaged' | 'both';

  let diff = '';
  if (mode === 'staged' || mode === 'both') {
    diff += execSync('git diff --cached', workspaceRoot);
  }
  if (mode === 'unstaged' || mode === 'both') {
    diff += execSync('git diff', workspaceRoot);
  }

  if (!diff.trim()) {
    vscode.window.showInformationMessage('CodeBreeze: No git changes found');
    return;
  }

  const branch = execSync('git branch --show-current', workspaceRoot).trim();
  const header = `## Git Diff (${mode}) — branch: ${branch}\n\n`;
  await writeClipboard(header + '```diff\n' + diff + '\n```');
  vscode.window.showInformationMessage('CodeBreeze: Git diff copied to clipboard');
}

export async function copyGitLogForAI(): Promise<void> {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) return;

  const config = getConfig();
  // B-022: clamp gitLogCount to prevent excessive output
  const count = Math.max(1, Math.min(config.gitLogCount, 500));
  const log = execSync(
    `git log --oneline -${count} --format="%h %s (%an, %ar)"`,
    workspaceRoot
  );

  if (!log.trim()) {
    vscode.window.showInformationMessage('CodeBreeze: No git log found');
    return;
  }

  const branch = execSync('git branch --show-current', workspaceRoot).trim();
  const markdown = `## Git Log — branch: ${branch}\n\n\`\`\`\n${log}\n\`\`\``;

  await writeClipboard(markdown);
  vscode.window.showInformationMessage('CodeBreeze: Git log copied to clipboard');
}

export function getGitDiff(workspaceRoot: string, mode: 'staged' | 'unstaged' | 'both'): string {
  let diff = '';
  if (mode === 'staged' || mode === 'both') {
    diff += execSync('git diff --cached', workspaceRoot);
  }
  if (mode === 'unstaged' || mode === 'both') {
    diff += execSync('git diff', workspaceRoot);
  }
  return diff;
}

export function getGitLog(workspaceRoot: string, count: number): string {
  return execSync(`git log --oneline -${count} --format="%h %s (%an, %ar)"`, workspaceRoot);
}

export function getCurrentBranch(workspaceRoot: string): string {
  return execSync('git branch --show-current', workspaceRoot).trim();
}
