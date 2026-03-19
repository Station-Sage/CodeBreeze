import * as vscode from 'vscode';
import * as fs from 'fs';
import { getConfig } from '../config';
import { formatCodeBlock } from '../utils/markdown';

export async function copyErrorsForAI(): Promise<void> {
  const markdown = buildErrorsMarkdown();
  if (!markdown) {
    vscode.window.showInformationMessage('CodeBreeze: No errors/warnings found');
    return;
  }

  await vscode.env.clipboard.writeText(markdown);
  vscode.window.showInformationMessage('CodeBreeze: Errors copied to clipboard');
}

export function buildErrorsMarkdown(): string | null {
  const config = getConfig();
  const allDiagnostics = vscode.languages.getDiagnostics();
  const errors: string[] = [];

  for (const [uri, diagnostics] of allDiagnostics) {
    const relevant = diagnostics.filter(
      (d) =>
        d.severity === vscode.DiagnosticSeverity.Error ||
        d.severity === vscode.DiagnosticSeverity.Warning
    );
    if (relevant.length === 0) continue;

    const relPath = vscode.workspace.asRelativePath(uri);

    for (const diag of relevant) {
      const sev = diag.severity === vscode.DiagnosticSeverity.Error ? 'error' : 'warning';
      const line = diag.range.start.line + 1;
      const col = diag.range.start.character + 1;
      errors.push(`${relPath}:${line}:${col} [${sev}] ${diag.message}`);

      // Attach code context
      const context = getCodeContext(uri.fsPath, line, config.contextLines);
      if (context) {
        errors.push(
          formatCodeBlock(
            context,
            getLanguage(uri.fsPath),
            `${relPath}:${Math.max(1, line - config.contextLines)}-${line + config.contextLines}`
          )
        );
      }
      errors.push('');
    }
  }

  if (errors.length === 0) return null;
  return `## VS Code Errors & Warnings\n\n${errors.join('\n')}`;
}

function getCodeContext(filePath: string, centerLine: number, contextLines: number): string | null {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const start = Math.max(0, centerLine - contextLines - 1);
    const end = Math.min(lines.length, centerLine + contextLines);
    return lines
      .slice(start, end)
      .map((line, i) => `${start + i + 1}: ${line}`)
      .join('\n');
  } catch {
    return null;
  }
}

function getLanguage(filePath: string): string {
  const ext = filePath.split('.').pop() || '';
  const map: Record<string, string> = {
    ts: 'typescript',
    js: 'javascript',
    py: 'python',
    go: 'go',
    rs: 'rust',
    java: 'java',
    cs: 'csharp',
    cpp: 'cpp',
    c: 'c',
    rb: 'ruby',
    php: 'php',
    swift: 'swift',
    kt: 'kotlin',
  };
  return map[ext] || ext;
}

export function getDiagnosticsMarkdown(): string {
  return buildErrorsMarkdown() || '';
}
