import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getWorkspaceRoot } from '../config';
import { writeClipboard } from '../utils/clipboardCompat';

interface FileSymbols {
  filePath: string;
  symbols: string[];
}

const INCLUDE_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.py', '.kt', '.java', '.go', '.rs'];
const EXCLUDE_DIRS = ['node_modules', '.git', 'dist', 'out', 'build', '__pycache__', '.next'];

/** Regex-based signature extractor (lightweight, no tree-sitter) */
function extractSymbols(content: string, ext: string): string[] {
  const symbols: string[] = [];
  const lines = content.split('\n');

  const patterns: RegExp[] = [];

  if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
    patterns.push(
      /^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*[(<]/,
      /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/,
      /^(?:export\s+)?interface\s+(\w+)/,
      /^(?:export\s+)?type\s+(\w+)\s*=/,
      /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*(?::\s*[\w<>[\]|&]+)?\s*=\s*(?:async\s+)?\(/,
    );
  } else if (ext === '.py') {
    patterns.push(
      /^(?:    )?def\s+(\w+)\s*\(/,
      /^class\s+(\w+)/,
    );
  } else if (ext === '.kt') {
    patterns.push(
      /^(?:    )?(?:suspend\s+)?fun\s+(\w+)\s*[(<]/,
      /^(?:data\s+|sealed\s+|abstract\s+)?class\s+(\w+)/,
      /^interface\s+(\w+)/,
    );
  } else if (ext === '.java') {
    patterns.push(
      /^\s*(?:public|private|protected)?\s*(?:static\s+)?(?:\w+\s+)+(\w+)\s*\(/,
      /^\s*(?:public|private|protected)?\s*(?:abstract\s+)?class\s+(\w+)/,
      /^\s*(?:public\s+)?interface\s+(\w+)/,
    );
  } else if (ext === '.go') {
    patterns.push(
      /^func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(/,
      /^type\s+(\w+)\s+struct/,
      /^type\s+(\w+)\s+interface/,
    );
  } else if (ext === '.rs') {
    patterns.push(
      /^(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/,
      /^(?:pub\s+)?struct\s+(\w+)/,
      /^(?:pub\s+)?trait\s+(\w+)/,
    );
  }

  for (const line of lines) {
    for (const pattern of patterns) {
      const m = line.match(pattern);
      if (m && m[1] && !m[1].startsWith('_')) {
        symbols.push(m[1]);
        break;
      }
    }
  }

  // deduplicate preserving order
  return [...new Set(symbols)];
}

function walkDir(dir: string, results: FileSymbols[], maxFiles = 200): void {
  if (results.length >= maxFiles) return;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (results.length >= maxFiles) break;
    if (EXCLUDE_DIRS.includes(entry.name)) continue;

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, results, maxFiles);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (!INCLUDE_EXTS.includes(ext)) continue;
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const symbols = extractSymbols(content, ext);
        if (symbols.length > 0) {
          results.push({ filePath: fullPath, symbols });
        }
      } catch {
        // skip unreadable files
      }
    }
  }
}

export async function getProjectMap(): Promise<string> {
  const root = getWorkspaceRoot();
  if (!root) return '';

  const fileSymbols: FileSymbols[] = [];
  walkDir(root, fileSymbols);

  if (fileSymbols.length === 0) return '';

  const lines: string[] = ['## Project Map'];
  for (const { filePath, symbols } of fileSymbols) {
    const rel = vscode.workspace.asRelativePath(filePath);
    lines.push(`- **${rel}**: ${symbols.slice(0, 15).join(', ')}`);
  }

  return lines.join('\n');
}

export async function copyProjectMap(): Promise<void> {
  const map = await getProjectMap();
  if (!map) {
    vscode.window.showInformationMessage('CodeBreeze: No project files found');
    return;
  }
  await writeClipboard(map);
  vscode.window.showInformationMessage('CodeBreeze: Project map copied to clipboard');
}
