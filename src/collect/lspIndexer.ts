// src/collect/lspIndexer.ts
// LSP-based codebase symbol indexer — Phase 10-1
// Uses VS Code's built-in DocumentSymbolProvider for accurate symbol extraction.
// Falls back to regex-based projectMapCollector when LSP is unavailable.

import * as vscode from 'vscode';
import * as path from 'path';
import { getWorkspaceRoot } from '../config';

export interface SymbolEntry {
  name: string;
  kind: vscode.SymbolKind;
  range: { startLine: number; endLine: number };
  containerName?: string;
  children?: SymbolEntry[];
}

export interface FileIndex {
  relativePath: string;
  uri: vscode.Uri;
  symbols: SymbolEntry[];
  lastIndexed: number;
}

/** Workspace-level symbol index, cached in memory */
const indexCache = new Map<string, FileIndex>();

const INCLUDE_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.py', '.kt', '.java', '.go', '.rs', '.c', '.cpp', '.h'];
const EXCLUDE_PATTERNS = ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/out/**', '**/build/**', '**/__pycache__/**', '**/.next/**'];
const MAX_FILES = 300;

let fileWatcher: vscode.FileSystemWatcher | undefined;

function toSymbolEntry(symbol: vscode.DocumentSymbol): SymbolEntry {
  const entry: SymbolEntry = {
    name: symbol.name,
    kind: symbol.kind,
    range: { startLine: symbol.range.start.line, endLine: symbol.range.end.line },
  };
  if (symbol.detail) {
    entry.containerName = symbol.detail;
  }
  if (symbol.children && symbol.children.length > 0) {
    entry.children = symbol.children.map(toSymbolEntry);
  }
  return entry;
}

/**
 * Index a single file using LSP DocumentSymbolProvider.
 * Returns null if no symbol provider is available.
 */
export async function indexFile(uri: vscode.Uri): Promise<FileIndex | null> {
  const root = getWorkspaceRoot();
  if (!root) return null;

  try {
    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
      'vscode.executeDocumentSymbolProvider',
      uri
    );

    if (!symbols || symbols.length === 0) return null;

    const relativePath = path.relative(root, uri.fsPath);
    const fileIndex: FileIndex = {
      relativePath,
      uri,
      symbols: symbols.map(toSymbolEntry),
      lastIndexed: Date.now(),
    };

    indexCache.set(uri.fsPath, fileIndex);
    return fileIndex;
  } catch {
    return null;
  }
}

/**
 * Index all workspace files matching supported extensions.
 * Skips already-indexed files unless force=true.
 */
export async function indexWorkspace(force = false): Promise<Map<string, FileIndex>> {
  const root = getWorkspaceRoot();
  if (!root) return indexCache;

  const includeGlob = `**/*{${INCLUDE_EXTS.join(',')}}`;
  const excludeGlob = `{${EXCLUDE_PATTERNS.join(',')}}`;
  const files = await vscode.workspace.findFiles(includeGlob, excludeGlob, MAX_FILES);

  for (const uri of files) {
    if (!force && indexCache.has(uri.fsPath)) {
      const cached = indexCache.get(uri.fsPath)!;
      // Skip if indexed within last 60 seconds
      if (Date.now() - cached.lastIndexed < 60_000) continue;
    }
    await indexFile(uri);
  }

  return indexCache;
}

/**
 * Search symbols by name pattern across the indexed workspace.
 */
export function searchSymbols(query: string, kindFilter?: vscode.SymbolKind): (SymbolEntry & { file: string })[] {
  const results: (SymbolEntry & { file: string })[] = [];
  const lowerQuery = query.toLowerCase();

  for (const [, fileIndex] of indexCache) {
    collectMatching(fileIndex.symbols, fileIndex.relativePath, lowerQuery, kindFilter, results);
  }

  return results;
}

function collectMatching(
  symbols: SymbolEntry[],
  filePath: string,
  lowerQuery: string,
  kindFilter: vscode.SymbolKind | undefined,
  results: (SymbolEntry & { file: string })[]
): void {
  for (const sym of symbols) {
    const nameMatch = sym.name.toLowerCase().includes(lowerQuery);
    const kindMatch = kindFilter === undefined || sym.kind === kindFilter;
    if (nameMatch && kindMatch) {
      results.push({ ...sym, file: filePath });
    }
    if (sym.children) {
      collectMatching(sym.children, filePath, lowerQuery, kindFilter, results);
    }
  }
}

/**
 * Get LSP-enhanced project map string (replaces regex-based getProjectMap when available).
 */
export async function getLspProjectMap(): Promise<string> {
  await indexWorkspace();

  if (indexCache.size === 0) return '';

  const lines: string[] = ['## Project Map (LSP)'];
  for (const [, fileIndex] of indexCache) {
    const topSymbols = fileIndex.symbols
      .map((s) => symbolKindLabel(s.kind) + s.name)
      .slice(0, 15);
    if (topSymbols.length > 0) {
      lines.push(`- **${fileIndex.relativePath}**: ${topSymbols.join(', ')}`);
    }
  }

  return lines.join('\n');
}

function symbolKindLabel(kind: vscode.SymbolKind): string {
  switch (kind) {
    case vscode.SymbolKind.Function:
    case vscode.SymbolKind.Method:
      return 'ƒ';
    case vscode.SymbolKind.Class:
      return '◆';
    case vscode.SymbolKind.Interface:
      return '◇';
    case vscode.SymbolKind.Enum:
      return '▣';
    case vscode.SymbolKind.Variable:
    case vscode.SymbolKind.Constant:
      return '▪';
    case vscode.SymbolKind.TypeParameter:
      return '⬡';
    default:
      return '';
  }
}

/**
 * Flatten all symbols from the index into a simple list for MCP/external use.
 */
export function getAllSymbolsFlat(): { file: string; name: string; kind: string; startLine: number; endLine: number }[] {
  const results: { file: string; name: string; kind: string; startLine: number; endLine: number }[] = [];
  for (const [, fileIndex] of indexCache) {
    flattenSymbols(fileIndex.symbols, fileIndex.relativePath, results);
  }
  return results;
}

function flattenSymbols(
  symbols: SymbolEntry[],
  filePath: string,
  results: { file: string; name: string; kind: string; startLine: number; endLine: number }[]
): void {
  for (const sym of symbols) {
    results.push({
      file: filePath,
      name: sym.name,
      kind: vscode.SymbolKind[sym.kind],
      startLine: sym.range.startLine,
      endLine: sym.range.endLine,
    });
    if (sym.children) {
      flattenSymbols(sym.children, filePath, results);
    }
  }
}

/** Start watching file saves for incremental index updates */
export function startIncrementalWatcher(): vscode.Disposable {
  if (fileWatcher) fileWatcher.dispose();

  fileWatcher = vscode.workspace.createFileSystemWatcher(`**/*{${INCLUDE_EXTS.join(',')}}`);

  const onSave = vscode.workspace.onDidSaveTextDocument((doc) => {
    const ext = path.extname(doc.uri.fsPath);
    if (INCLUDE_EXTS.includes(ext)) {
      indexFile(doc.uri);
    }
  });

  const onDelete = fileWatcher.onDidDelete((uri) => {
    indexCache.delete(uri.fsPath);
  });

  return vscode.Disposable.from(fileWatcher, onSave, onDelete);
}

/** Clear the index cache */
export function clearIndexCache(): void {
  indexCache.clear();
}

/** Get the current cache size */
export function getIndexedFileCount(): number {
  return indexCache.size;
}
