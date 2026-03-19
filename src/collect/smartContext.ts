import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getConfig, getWorkspaceRoot } from '../config';
import { formatCodeBlock } from '../utils/markdown';
import { getDiagnosticsMarkdown } from './errorCollector';
import { getGitDiff, getCurrentBranch } from './gitCollector';
import { getLastBuildResult } from './localBuildCollector';
import { getProjectMap } from './projectMapCollector';
import { formatProjectRulesSection } from './rulesLoader';
import { getLspProjectMap, indexWorkspace } from './lspIndexer';
import { findReferencesByName, formatReferencesMarkdown } from './lspReferences';

export async function copySmartContext(): Promise<void> {
  const markdown = await buildSmartContext();
  if (!markdown) {
    vscode.window.showInformationMessage('CodeBreeze: No context available');
    return;
  }

  await vscode.env.clipboard.writeText(markdown);
  vscode.window.showInformationMessage('CodeBreeze: Smart context copied to clipboard');
}

export async function buildSmartContext(): Promise<string> {
  const parts: string[] = [];
  const workspaceRoot = getWorkspaceRoot();

  // 0. Project rules (prepended first)
  const rulesSection = formatProjectRulesSection();
  if (rulesSection) {
    parts.push(rulesSection);
  }

  // 1. Current file
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const doc = editor.document;
    const relPath = vscode.workspace.asRelativePath(doc.uri);
    parts.push(`## Current File: ${relPath}`);
    parts.push(formatCodeBlock(doc.getText(), doc.languageId, relPath));
  }

  // 2. Errors from diagnostics
  const errorsMarkdown = getDiagnosticsMarkdown();
  if (errorsMarkdown) {
    parts.push(errorsMarkdown);
  }

  // 3. Last build log (if recent, within 5 minutes)
  const buildResult = getLastBuildResult();
  if (
    buildResult &&
    Date.now() - buildResult.timestamp < 5 * 60 * 1000 &&
    buildResult.exitCode !== 0
  ) {
    parts.push(`## Recent Build Failure (${buildResult.command})`);
    parts.push('```');
    parts.push((buildResult.stdout + buildResult.stderr).split('\n').slice(-30).join('\n'));
    parts.push('```');
  }

  // 4. Git diff (if any changes)
  if (workspaceRoot) {
    const diff = getGitDiff(workspaceRoot, 'unstaged');
    if (diff.trim()) {
      const branch = getCurrentBranch(workspaceRoot);
      parts.push(`## Git Changes (${branch})`);
      parts.push('```diff');
      parts.push(diff.trim());
      parts.push('```');
    }
  }

  // 5. .ai/ folder docs (if exists)
  if (workspaceRoot) {
    const aiDir = path.join(workspaceRoot, '.ai');
    if (fs.existsSync(aiDir)) {
      try {
        const files = fs.readdirSync(aiDir).filter((f) => f.endsWith('.md'));
        for (const file of files.slice(0, 3)) {
          const content = fs.readFileSync(path.join(aiDir, file), 'utf8');
          parts.push(`## Project Context (${file})`);
          parts.push(content);
        }
      } catch {
        // ignore
      }
    }
  }

  // 6. Auto-mode: LSP-enhanced project map + related symbols
  const config = getConfig();
  if (config.smartContextMode === 'auto') {
    try {
      const lspMap = await getLspProjectMap();
      if (lspMap) {
        parts.push(lspMap);
      }

      // Auto-collect references for symbols at error locations
      if (editor) {
        const doc = editor.document;
        const diagnostics = vscode.languages.getDiagnostics(doc.uri);
        const errorSymbols = new Set<string>();
        for (const diag of diagnostics.slice(0, 5)) {
          if (diag.severity === vscode.DiagnosticSeverity.Error) {
            const wordRange = doc.getWordRangeAtPosition(diag.range.start);
            if (wordRange) errorSymbols.add(doc.getText(wordRange));
          }
        }
        for (const sym of errorSymbols) {
          const refs = await findReferencesByName(sym);
          if (refs && refs.references.length > 0) {
            parts.push(formatReferencesMarkdown(refs));
          }
        }
      }
    } catch {
      // LSP not available, skip
    }
  }

  return parts.join('\n\n');
}

export async function buildContextPayload(types: string[], includeRules = true): Promise<string> {
  const parts: string[] = [];
  const config = getConfig();
  const workspaceRoot = getWorkspaceRoot();
  const editor = vscode.window.activeTextEditor;

  // Prepend project rules if available
  if (includeRules) {
    const rulesSection = formatProjectRulesSection();
    if (rulesSection) {
      parts.push(rulesSection);
    }
  }

  for (const type of types) {
    switch (type) {
      case 'file':
        if (editor) {
          const doc = editor.document;
          const relPath = vscode.workspace.asRelativePath(doc.uri);
          parts.push(formatCodeBlock(doc.getText(), doc.languageId, relPath));
        }
        break;

      case 'selection':
        if (editor && !editor.selection.isEmpty) {
          const doc = editor.document;
          const relPath = vscode.workspace.asRelativePath(doc.uri);
          const sel = editor.selection;
          parts.push(
            formatCodeBlock(
              doc.getText(sel),
              doc.languageId,
              `${relPath}:${sel.start.line + 1}-${sel.end.line + 1}`
            )
          );
        }
        break;

      case 'errors': {
        const md = getDiagnosticsMarkdown();
        if (md) parts.push(md);
        break;
      }

      case 'gitDiff':
        if (workspaceRoot) {
          const diff = getGitDiff(workspaceRoot, config.gitDiffMode);
          if (diff.trim()) parts.push('## Git Diff\n```diff\n' + diff + '\n```');
        }
        break;

      case 'gitLog':
        if (workspaceRoot) {
          const { getGitLog } = await import('./gitCollector');
          const log = getGitLog(workspaceRoot, config.gitLogCount);
          if (log.trim()) parts.push('## Git Log\n```\n' + log + '\n```');
        }
        break;

      case 'buildLog': {
        const result = getLastBuildResult();
        if (result) {
          parts.push(`## Build Log\n\`\`\`\n${result.stdout}${result.stderr}\n\`\`\``);
        }
        break;
      }

      case 'projectMap': {
        const map = await getProjectMap();
        if (map) parts.push(map);
        break;
      }

      case 'lspProjectMap': {
        const lspMap = await getLspProjectMap();
        if (lspMap) parts.push(lspMap);
        break;
      }
    }
  }

  return parts.join('\n\n');
}
