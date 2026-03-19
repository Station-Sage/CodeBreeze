// src/collect/errorChainCollector.ts
// Traces import/require chains from error files to collect related file context.

import * as fs from 'fs';
import * as path from 'path';

export interface ImportChainResult {
  /** Original error file */
  errorFile: string;
  /** Files imported by the error file (and their imports, up to depth) */
  chainFiles: string[];
}

/**
 * Regex patterns for extracting import/require paths from source files.
 * Supports: TypeScript/JavaScript, Python, C/C++, Go, Rust, Java/Kotlin.
 */
const IMPORT_PATTERNS: RegExp[] = [
  // ES import: import ... from 'path'  or  import 'path'
  /import\s+(?:.*?\s+from\s+)?['"]([^'"]+)['"]/g,
  // CommonJS require: require('path')
  /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  // Python: from module import ... or import module
  /^(?:from|import)\s+([\w.]+)/gm,
  // C/C++: #include "path"
  /#include\s*"([^"]+)"/g,
  // Go: import "path" (single)
  /import\s+"([^"]+)"/g,
  // Rust: mod name; or use crate::path
  /(?:mod|use)\s+([\w:]+)/g,
];

/** Known source file extensions for resolving bare imports */
const SOURCE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.go',
  '.rs',
  '.c',
  '.cpp',
  '.h',
  '.hpp',
  '.java',
  '.kt',
];

/**
 * Extract import paths from a source file's content.
 */
export function extractImports(content: string): string[] {
  const imports: string[] = [];
  const seen = new Set<string>();

  for (const pattern of IMPORT_PATTERNS) {
    // Reset lastIndex for global regexes
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const importPath = match[1];
      if (importPath && !seen.has(importPath)) {
        seen.add(importPath);
        imports.push(importPath);
      }
    }
  }

  return imports;
}

/**
 * Resolve an import path to an absolute file path.
 * Tries the import as-is, then with common extensions, then as index file.
 */
export function resolveImportPath(
  importPath: string,
  fromFile: string,
  _workspaceRoot: string
): string | null {
  // Skip node_modules / external packages
  if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
    return null;
  }

  const dir = path.dirname(fromFile);
  const candidate = path.resolve(dir, importPath);

  // Try exact path
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return candidate;
  }

  // Try with extensions
  for (const ext of SOURCE_EXTENSIONS) {
    const withExt = candidate + ext;
    if (fs.existsSync(withExt)) {
      return withExt;
    }
  }

  // Try as directory with index file
  for (const ext of SOURCE_EXTENSIONS) {
    const indexFile = path.join(candidate, `index${ext}`);
    if (fs.existsSync(indexFile)) {
      return indexFile;
    }
  }

  return null;
}

/**
 * Trace import chain from a file up to a given depth.
 * Returns list of resolved absolute file paths (excluding the root file).
 */
export function traceImportChain(
  filePath: string,
  workspaceRoot: string,
  maxDepth: number = 2
): string[] {
  const visited = new Set<string>();
  const result: string[] = [];

  function traverse(file: string, depth: number): void {
    const normalized = path.normalize(file);
    if (visited.has(normalized) || depth > maxDepth) {
      return;
    }
    visited.add(normalized);

    let content: string;
    try {
      content = fs.readFileSync(normalized, 'utf8');
    } catch {
      return;
    }

    const imports = extractImports(content);
    for (const imp of imports) {
      const resolved = resolveImportPath(imp, normalized, workspaceRoot);
      if (resolved && !visited.has(path.normalize(resolved))) {
        result.push(resolved);
        traverse(resolved, depth + 1);
      }
    }
  }

  traverse(filePath, 0);
  return result;
}

/**
 * For each error file, trace its import chain and return all related files.
 * Used by agent loop to send richer context to AI.
 */
export function getErrorChainFiles(
  errorFilePaths: string[],
  workspaceRoot: string,
  depth: number = 2
): ImportChainResult[] {
  return errorFilePaths.map((errorFile) => {
    const absPath = path.isAbsolute(errorFile) ? errorFile : path.join(workspaceRoot, errorFile);
    return {
      errorFile,
      chainFiles: traceImportChain(absPath, workspaceRoot, depth),
    };
  });
}
