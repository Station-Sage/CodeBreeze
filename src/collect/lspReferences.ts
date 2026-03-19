// src/collect/lspReferences.ts
// LSP-based reference tracking and call hierarchy — Phase 10-2
// Uses VS Code's ReferenceProvider and CallHierarchyProvider APIs.

import * as vscode from 'vscode';
import * as path from 'path';
import { getWorkspaceRoot } from '../config';

export interface ReferenceResult {
  symbol: string;
  definitionFile: string;
  definitionLine: number;
  references: { file: string; line: number; preview: string }[];
}

export interface CallHierarchyResult {
  symbol: string;
  file: string;
  line: number;
  callers: { name: string; file: string; line: number }[];
  callees: { name: string; file: string; line: number }[];
}

/**
 * Find all references to the symbol at the given position.
 */
export async function findReferences(
  uri: vscode.Uri,
  position: vscode.Position,
  includeDeclaration = true
): Promise<ReferenceResult | null> {
  const root = getWorkspaceRoot();
  if (!root) return null;

  try {
    const locations = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeReferenceProvider',
      uri,
      position
    );

    if (!locations || locations.length === 0) return null;

    // Get symbol name from the document
    const doc = await vscode.workspace.openTextDocument(uri);
    const wordRange = doc.getWordRangeAtPosition(position);
    const symbolName = wordRange ? doc.getText(wordRange) : 'unknown';

    // B-023: use allSettled so one failed doc open doesn't lose all results
    const settled = await Promise.allSettled(
      locations
        .filter(
          (loc) => includeDeclaration || !loc.range.isEqual(new vscode.Range(position, position))
        )
        .slice(0, 50) // limit results
        .map(async (loc) => {
          const refDoc = await vscode.workspace.openTextDocument(loc.uri);
          const lineText = refDoc.lineAt(loc.range.start.line).text.trim();
          return {
            file: path.relative(root, loc.uri.fsPath),
            line: loc.range.start.line + 1,
            preview: lineText.slice(0, 120),
          };
        })
    );
    const refs = settled
      .filter((r): r is PromiseFulfilledResult<{ file: string; line: number; preview: string }> => r.status === 'fulfilled')
      .map((r) => r.value);

    return {
      symbol: symbolName,
      definitionFile: path.relative(root, uri.fsPath),
      definitionLine: position.line + 1,
      references: refs,
    };
  } catch {
    return null;
  }
}

/**
 * Get call hierarchy (callers + callees) for the symbol at the given position.
 */
export async function getCallHierarchy(
  uri: vscode.Uri,
  position: vscode.Position
): Promise<CallHierarchyResult | null> {
  const root = getWorkspaceRoot();
  if (!root) return null;

  try {
    const items = await vscode.commands.executeCommand<vscode.CallHierarchyItem[]>(
      'vscode.prepareCallHierarchy',
      uri,
      position
    );

    if (!items || items.length === 0) return null;

    const item = items[0];

    // Get incoming calls (callers)
    const incomingCalls = await vscode.commands.executeCommand<vscode.CallHierarchyIncomingCall[]>(
      'vscode.provideIncomingCalls',
      item
    );

    // Get outgoing calls (callees)
    const outgoingCalls = await vscode.commands.executeCommand<vscode.CallHierarchyOutgoingCall[]>(
      'vscode.provideOutgoingCalls',
      item
    );

    const callers = (incomingCalls || []).slice(0, 30).map((call) => ({
      name: call.from.name,
      file: path.relative(root, call.from.uri.fsPath),
      line: call.from.range.start.line + 1,
    }));

    const callees = (outgoingCalls || []).slice(0, 30).map((call) => ({
      name: call.to.name,
      file: path.relative(root, call.to.uri.fsPath),
      line: call.to.range.start.line + 1,
    }));

    return {
      symbol: item.name,
      file: path.relative(root, item.uri.fsPath),
      line: item.range.start.line + 1,
      callers,
      callees,
    };
  } catch {
    return null;
  }
}

/**
 * Find references to a symbol by name (searches index first, then uses LSP).
 * Useful for MCP/external tools that don't have cursor position.
 */
export async function findReferencesByName(
  symbolName: string,
  filePath?: string
): Promise<ReferenceResult | null> {
  const root = getWorkspaceRoot();
  if (!root) return null;

  // Find the symbol in workspace using workspace symbol provider
  const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
    'vscode.executeWorkspaceSymbolProvider',
    symbolName
  );

  if (!symbols || symbols.length === 0) return null;

  // If filePath specified, prefer match in that file
  let target = symbols[0];
  if (filePath) {
    const absPath = path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
    const match = symbols.find((s) => s.location.uri.fsPath === absPath);
    if (match) target = match;
  }

  return findReferences(target.location.uri, target.location.range.start, true);
}

/**
 * Format references as markdown for AI context.
 */
export function formatReferencesMarkdown(result: ReferenceResult): string {
  const lines: string[] = [
    `## References: \`${result.symbol}\``,
    `Defined in **${result.definitionFile}:${result.definitionLine}**`,
    `Found ${result.references.length} reference(s):`,
    '',
  ];

  for (const ref of result.references) {
    lines.push(`- **${ref.file}:${ref.line}** — \`${ref.preview}\``);
  }

  return lines.join('\n');
}

/**
 * Format call hierarchy as markdown for AI context.
 */
export function formatCallHierarchyMarkdown(result: CallHierarchyResult): string {
  const lines: string[] = [
    `## Call Hierarchy: \`${result.symbol}\``,
    `Location: **${result.file}:${result.line}**`,
    '',
  ];

  if (result.callers.length > 0) {
    lines.push(`### Called by (${result.callers.length}):`);
    for (const caller of result.callers) {
      lines.push(`- \`${caller.name}\` in **${caller.file}:${caller.line}**`);
    }
    lines.push('');
  }

  if (result.callees.length > 0) {
    lines.push(`### Calls (${result.callees.length}):`);
    for (const callee of result.callees) {
      lines.push(`- \`${callee.name}\` in **${callee.file}:${callee.line}**`);
    }
  }

  return lines.join('\n');
}
