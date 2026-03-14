import * as vscode from 'vscode';
import * as path from 'path';
import { getConfig, getWorkspaceRoot } from '../config';

export async function findWorkspaceFile(partialPath: string): Promise<vscode.Uri | null> {
  if (!partialPath) return null;

  const config = getConfig();
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) return null;

  // Try exact match first
  let files = await vscode.workspace.findFiles(partialPath, '**/node_modules/**', 5);

  // Try with source root prefix
  if (files.length === 0 && config.sourceRoot) {
    files = await vscode.workspace.findFiles(
      `${config.sourceRoot}/${partialPath}`,
      '**/node_modules/**',
      5
    );
  }

  // Try basename glob fallback
  if (files.length === 0) {
    const basename = path.basename(partialPath);
    files = await vscode.workspace.findFiles(`**/${basename}`, '**/node_modules/**', 10);
    // Filter to those matching the partial path suffix
    const suffix = partialPath.replace(/\\/g, '/');
    const filtered = files.filter((f) => f.fsPath.replace(/\\/g, '/').endsWith(suffix));
    if (filtered.length > 0) {
      files = filtered;
    }
  }

  if (files.length === 0) return null;
  if (files.length === 1) return files[0];

  // Multiple matches - let user pick
  const items = files.map((f) => ({
    label: vscode.workspace.asRelativePath(f),
    uri: f,
  }));
  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: `Multiple files match "${partialPath}" - select one`,
  });
  return picked?.uri ?? null;
}

export async function resolveOrCreateFile(filePath: string): Promise<vscode.Uri | null> {
  const existing = await findWorkspaceFile(filePath);
  if (existing) return existing;

  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) return null;

  const answer = await vscode.window.showInformationMessage(
    `File not found: "${filePath}". Create it?`,
    'Create',
    'Cancel'
  );

  if (answer !== 'Create') return null;

  const newUri = vscode.Uri.joinPath(vscode.Uri.file(workspaceRoot), filePath);
  await vscode.workspace.fs.writeFile(newUri, new Uint8Array());
  return newUri;
}
