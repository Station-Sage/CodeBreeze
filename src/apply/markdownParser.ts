import * as vscode from 'vscode';
import { CodeBlock } from '../types';

const CODE_FENCE_REGEX = /^```([\w+-]*)(?::(.+?))?\s*\r?\n([\s\S]*?)^```/gm;

/** Matches incomplete code blocks (opening ``` without closing ```) */
const INCOMPLETE_FENCE_REGEX = /^```([\w+-]*)(?::(.+?))?\s*\r?\n([\s\S]+)$/gm;

const FILE_PATH_COMMENT_PATTERNS = [
  /\/\/\s*(?:filepath|file|path):\s*(.+)/i,
  /#\s*(?:file|path|filepath):\s*(.+)/i,
  /<!--\s*(?:file|path|filepath):\s*(.+?)\s*-->/i,
  /\/\*\s*(?:file|path|filepath):\s*(.+?)\s*\*\//i,
];

/** Size threshold for chunked parsing (100KB) */
const CHUNK_PARSE_THRESHOLD = 100 * 1024;

export function parseClipboard(text: string): CodeBlock[] {
  if (!text || text.trim().length === 0) return [];

  // For large content, use chunked parsing
  if (text.length > CHUNK_PARSE_THRESHOLD) {
    return parseChunked(text);
  }

  return parseInternal(text);
}

function parseInternal(text: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const lines = text.split('\n');

  let match: RegExpExecArray | null;
  CODE_FENCE_REGEX.lastIndex = 0;

  while ((match = CODE_FENCE_REGEX.exec(text)) !== null) {
    const language = match[1] || '';
    let filePath: string | null = match[2]?.trim() || null;
    const content = match[3];

    if (!filePath) {
      filePath = extractFilePathFromPrecedingLines(text, match.index, lines);
    }

    if (filePath) {
      filePath = filePath.trim().replace(/['"]/g, '');
    }

    const isDiff = detectDiff(content);

    blocks.push({ language, filePath, content: content.trimEnd(), isDiff });
  }

  // If no complete blocks found, check for incomplete code blocks
  if (blocks.length === 0) {
    const incompleteBlocks = parseIncompleteBlocks(text);
    if (incompleteBlocks.length > 0) {
      return incompleteBlocks;
    }
  }

  return blocks;
}

/**
 * Parse incomplete code blocks (missing closing ```).
 * Shows warning and attempts best-guess extraction.
 */
function parseIncompleteBlocks(text: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  INCOMPLETE_FENCE_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = INCOMPLETE_FENCE_REGEX.exec(text)) !== null) {
    const language = match[1] || '';
    let filePath: string | null = match[2]?.trim() || null;
    let content = match[3];

    if (!filePath) {
      filePath = extractFilePathFromPrecedingLines(text, match.index, text.split('\n'));
    }

    if (filePath) {
      filePath = filePath.trim().replace(/['"]/g, '');
    }

    // Trim any trailing incomplete lines that look like markdown
    const contentLines = content.split('\n');
    const trimmedLines: string[] = [];
    for (const line of contentLines) {
      // Stop if we hit what looks like markdown text after code
      if (/^[A-Z][a-z].*[.:]$/.test(line.trim()) && trimmedLines.length > 3) {
        break;
      }
      trimmedLines.push(line);
    }
    content = trimmedLines.join('\n').trimEnd();

    if (content.length >= 10) {
      const isDiff = detectDiff(content);
      blocks.push({ language, filePath, content, isDiff });
    }
  }

  if (blocks.length > 0) {
    // Show warning via VS Code API (imported at top)
    try {
      vscode.window.showWarningMessage(
        `CodeBreeze: ${blocks.length} incomplete code block(s) detected (missing closing \`\`\`). Applied best-guess parsing.`
      );
    } catch {
      // Running outside VS Code context (tests)
    }
  }

  return blocks;
}

/**
 * Chunked parsing for large clipboard content (100KB+).
 * Splits by code fence boundaries to avoid regex backtracking on huge strings.
 */
function parseChunked(text: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const fencePattern = /^```/gm;
  const fencePositions: number[] = [];

  let fenceMatch: RegExpExecArray | null;
  fencePattern.lastIndex = 0;
  while ((fenceMatch = fencePattern.exec(text)) !== null) {
    fencePositions.push(fenceMatch.index);
  }

  // Process pairs of fence positions
  for (let i = 0; i < fencePositions.length - 1; i += 2) {
    const start = fencePositions[i];
    const end = fencePositions[i + 1];
    if (end === undefined) break;

    // Find the end of the closing fence line
    const closingEnd = text.indexOf('\n', end);
    const chunk = text.substring(start, closingEnd === -1 ? end + 3 : closingEnd);
    const parsed = parseInternal(chunk + (chunk.endsWith('```') ? '' : '\n```'));

    // Carry over file path from preceding context
    for (const block of parsed) {
      if (!block.filePath) {
        block.filePath = extractFilePathFromPrecedingLines(
          text,
          start,
          text.substring(0, start).split('\n')
        );
      }
      blocks.push(block);
    }
  }

  // Check for incomplete final block
  if (fencePositions.length % 2 !== 0) {
    const lastStart = fencePositions[fencePositions.length - 1];
    const remainder = text.substring(lastStart);
    const incompleteBlocks = parseIncompleteBlocks(remainder);
    blocks.push(...incompleteBlocks);
  }

  return blocks;
}

function extractFilePathFromPrecedingLines(
  text: string,
  blockStart: number,
  _lines: string[]
): string | null {
  const preceding = text.substring(0, blockStart);
  const precedingLines = preceding.split('\n');

  // Check up to 3 lines before the code fence
  for (let i = precedingLines.length - 1; i >= Math.max(0, precedingLines.length - 4); i--) {
    const line = precedingLines[i].trim();
    if (!line) continue;

    for (const pattern of FILE_PATH_COMMENT_PATTERNS) {
      const m = line.match(pattern);
      if (m) {
        return m[1].trim();
      }
    }

    // Plain text line that looks like a file path
    if (/^[\w./-]+\.[a-zA-Z]{1,10}$/.test(line) && !line.startsWith('#')) {
      return line;
    }

    break; // Only look at consecutive non-empty lines
  }

  return null;
}

export function detectDiff(content: string): boolean {
  const firstLines = content.split('\n').slice(0, 5).join('\n');
  return (
    firstLines.includes('--- a/') ||
    firstLines.includes('+++ b/') ||
    /^diff --git/.test(firstLines) ||
    /^@@\s*-\d+/.test(firstLines)
  );
}
