// src/providers/completionContextBuilder.ts
// Completion Context Builder — Phase 11-3
// Builds focused context for inline code completion requests.
// Uses LSP symbols, surrounding code, and project rules.

import * as vscode from 'vscode';
import * as path from 'path';
import { getConfig, getWorkspaceRoot } from '../config';
import { formatProjectRulesSection } from '../collect/rulesLoader';

const MAX_CONTEXT_LINES = 50;
const MAX_TOKEN_ESTIMATE = 2000; // ~2000 tokens ≈ 8000 chars

/**
 * Build a focused context payload for inline completion.
 * Includes: cursor position, surrounding code, imports, LSP symbols, project rules.
 */
export async function buildCompletionContext(
  document: vscode.TextDocument,
  position: vscode.Position
): Promise<string> {
  const parts: string[] = [];
  const root = getWorkspaceRoot();
  const relPath = root ? path.relative(root, document.uri.fsPath) : document.fileName;

  // 1. Project rules (abbreviated)
  const rules = formatProjectRulesSection();
  if (rules) {
    const abbreviated = rules.split('\n').slice(0, 10).join('\n');
    parts.push(abbreviated);
  }

  // 2. Current file context (before + after cursor)
  const beforeLines = Math.min(position.line, MAX_CONTEXT_LINES);
  const afterLines = Math.min(document.lineCount - position.line - 1, 20);

  const beforeStart = Math.max(0, position.line - beforeLines);
  const afterEnd = Math.min(document.lineCount - 1, position.line + afterLines);

  const beforeText = document.getText(
    new vscode.Range(beforeStart, 0, position.line, position.character)
  );
  const afterText = document.getText(
    new vscode.Range(
      position.line,
      position.character,
      afterEnd,
      document.lineAt(afterEnd).text.length
    )
  );

  const currentLine = document.lineAt(position.line).text;

  parts.push(`## File: ${relPath} (line ${position.line + 1})`);
  parts.push('```' + document.languageId);
  parts.push(beforeText);
  parts.push('/* <<CURSOR>> */');
  parts.push(afterText);
  parts.push('```');

  // 3. Import context (first 20 lines usually contain imports)
  const importLines = document.getText(
    new vscode.Range(0, 0, Math.min(20, document.lineCount - 1), 0)
  );
  if (beforeStart > 20) {
    parts.push('## Imports');
    parts.push('```' + document.languageId);
    parts.push(importLines.trim());
    parts.push('```');
  }

  // 4. LSP symbol context (current file symbols)
  try {
    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      'vscode.executeDocumentSymbolProvider',
      document.uri
    );
    if (symbols && symbols.length > 0) {
      const currentSymbol = findContainingSymbol(symbols, position);
      if (currentSymbol) {
        parts.push(
          `## Current scope: ${currentSymbol.name} (${vscode.SymbolKind[currentSymbol.kind]})`
        );
      }

      const symbolList = symbols
        .map((s) => `${vscode.SymbolKind[s.kind]} ${s.name}`)
        .slice(0, 15)
        .join(', ');
      parts.push(`## File symbols: ${symbolList}`);
    }
  } catch {
    // LSP not available
  }

  // 5. Diagnostics at cursor location
  const diagnostics = vscode.languages.getDiagnostics(document.uri);
  const nearbyDiags = diagnostics.filter((d) => Math.abs(d.range.start.line - position.line) <= 3);
  if (nearbyDiags.length > 0) {
    parts.push('## Nearby diagnostics');
    for (const d of nearbyDiags.slice(0, 5)) {
      const severity = d.severity === vscode.DiagnosticSeverity.Error ? 'ERROR' : 'WARNING';
      parts.push(`- [${severity}] line ${d.range.start.line + 1}: ${d.message}`);
    }
  }

  // 6. Completion instruction
  parts.push('');
  parts.push(
    'Complete the code at the <<CURSOR>> position. Provide ONLY the code to insert, no explanation.'
  );

  // Trim to token budget
  let result = parts.join('\n');
  if (result.length > MAX_TOKEN_ESTIMATE * 4) {
    result = result.slice(0, MAX_TOKEN_ESTIMATE * 4);
  }

  return result;
}

/**
 * Find the symbol that contains the given position.
 */
function findContainingSymbol(
  symbols: vscode.DocumentSymbol[],
  position: vscode.Position
): vscode.DocumentSymbol | null {
  for (const sym of symbols) {
    if (sym.range.contains(position)) {
      // Check children for more specific match
      if (sym.children && sym.children.length > 0) {
        const child = findContainingSymbol(sym.children, position);
        if (child) return child;
      }
      return sym;
    }
  }
  return null;
}

/**
 * Get related files for the current document (based on imports).
 */
export async function getRelatedFileSymbols(document: vscode.TextDocument): Promise<string> {
  const root = getWorkspaceRoot();
  if (!root) return '';

  try {
    const { searchSymbols, indexWorkspace } = await import('../collect/lspIndexer');
    await indexWorkspace();

    // Extract function/variable names used in the current line area
    const lines: string[] = [];
    const text = document.getText();
    const identifiers = new Set<string>();
    const idRegex = /\b([A-Z]\w{2,})\b/g;
    let match;
    while ((match = idRegex.exec(text)) !== null) {
      identifiers.add(match[1]);
    }

    // Search for these identifiers in the workspace
    for (const id of [...identifiers].slice(0, 5)) {
      const results = searchSymbols(id);
      for (const r of results.slice(0, 3)) {
        lines.push(`- ${r.name} (${vscode.SymbolKind[r.kind]}) in ${r.file}`);
      }
    }

    if (lines.length > 0) {
      return '## Related symbols\n' + lines.join('\n');
    }
  } catch {
    // LSP not available
  }

  return '';
}
