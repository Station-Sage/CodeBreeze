import * as vscode from 'vscode';
import { formatCodeBlock, truncateLines } from '../utils/markdown';
import { getConfig } from '../config';
import { splitByBoundary } from './chunkSplitter';
import { writeClipboard } from '../utils/clipboardCompat';

export async function copyFileForAI(uri?: vscode.Uri): Promise<void> {
  let targetUri = uri;

  if (!targetUri) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showInformationMessage('CodeBreeze: No file open');
      return;
    }
    targetUri = editor.document.uri;
  }

  if (targetUri.scheme !== 'file') return;

  const doc = await vscode.workspace.openTextDocument(targetUri);
  const config = getConfig();
  const relPath = vscode.workspace.asRelativePath(targetUri);
  const lang = doc.languageId;

  let content = doc.getText();
  content = truncateLines(content, config.chunkMaxLines);

  const markdown = formatCodeBlock(content, lang, relPath);
  await writeClipboard(markdown);
  vscode.window.showInformationMessage(`CodeBreeze: Copied ${relPath} to clipboard`);
}

export async function copyMultipleFilesForAI(uris: vscode.Uri[]): Promise<void> {
  const parts: string[] = [];
  const config = getConfig();

  for (const uri of uris) {
    if (uri.scheme !== 'file') continue;
    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      const relPath = vscode.workspace.asRelativePath(uri);
      let content = doc.getText();
      content = truncateLines(content, config.chunkMaxLines);
      parts.push(formatCodeBlock(content, doc.languageId, relPath));
    } catch {
      // skip unreadable files
    }
  }

  if (parts.length === 0) {
    vscode.window.showInformationMessage('CodeBreeze: No files to copy');
    return;
  }

  await writeClipboard(parts.join('\n\n'));
  vscode.window.showInformationMessage(`CodeBreeze: Copied ${parts.length} files to clipboard`);
}

export async function copySelectionForAI(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.selection.isEmpty) {
    vscode.window.showInformationMessage('CodeBreeze: No selection');
    return;
  }

  const doc = editor.document;
  const selection = editor.selection;
  const relPath = vscode.workspace.asRelativePath(doc.uri);
  const startLine = selection.start.line + 1;
  const endLine = selection.end.line + 1;
  const selectedText = doc.getText(selection);

  const header = `// ${relPath} (lines ${startLine}-${endLine})`;
  const markdown = `${header}\n${formatCodeBlock(selectedText, doc.languageId, `${relPath}:${startLine}-${endLine}`)}`;

  await writeClipboard(markdown);
  vscode.window.showInformationMessage(
    `CodeBreeze: Copied selection (lines ${startLine}-${endLine}) to clipboard`
  );
}

export function buildFileMarkdown(
  filePath: string,
  lang: string,
  content: string,
  relPath: string
): string {
  return formatCodeBlock(content, lang, relPath);
}

/**
 * Split a large file by function/class boundaries and format each chunk.
 * Returns array of markdown code blocks, one per chunk.
 */
export function buildChunkedFileMarkdown(
  lang: string,
  content: string,
  relPath: string,
  maxLines: number
): string[] {
  const chunks = splitByBoundary(content, lang, maxLines);
  return chunks.map((chunk) => {
    const label = `${relPath}:${chunk.startLine}-${chunk.endLine} (${chunk.name})`;
    return formatCodeBlock(chunk.content, lang, label);
  });
}
