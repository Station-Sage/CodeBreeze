import { CodeBlock } from '../types';

const CODE_FENCE_REGEX = /^```([\w+-]*)(?::(.+?))?\s*\r?\n([\s\S]*?)^```/gm;

const FILE_PATH_COMMENT_PATTERNS = [
  /\/\/\s*(?:filepath|file|path):\s*(.+)/i,
  /#\s*(?:file|path|filepath):\s*(.+)/i,
  /<!--\s*(?:file|path|filepath):\s*(.+?)\s*-->/i,
  /\/\*\s*(?:file|path|filepath):\s*(.+?)\s*\*\//i,
];

export function parseClipboard(text: string): CodeBlock[] {
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
