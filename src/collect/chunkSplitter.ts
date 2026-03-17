// src/collect/chunkSplitter.ts
// Splits file content by function/class boundaries for smart context collection.

export interface Chunk {
  startLine: number;
  endLine: number;
  name: string;
  kind: 'function' | 'class' | 'block';
  content: string;
}

/**
 * Language-specific boundary patterns.
 * Each captures the symbol name in group 1.
 */
const BOUNDARY_PATTERNS: Record<string, RegExp[]> = {
  typescript: [
    /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
    /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/,
    /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/,
    /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=])\s*=>/,
    /^(?:export\s+)?interface\s+(\w+)/,
    /^(?:export\s+)?type\s+(\w+)/,
    /^(?:export\s+)?enum\s+(\w+)/,
  ],
  javascript: [
    /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
    /^(?:export\s+)?class\s+(\w+)/,
    /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/,
    /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=])\s*=>/,
  ],
  python: [
    /^(?:async\s+)?def\s+(\w+)/,
    /^class\s+(\w+)/,
  ],
  go: [
    /^func\s+(?:\([^)]+\)\s+)?(\w+)/,
    /^type\s+(\w+)\s+struct/,
    /^type\s+(\w+)\s+interface/,
  ],
  rust: [
    /^(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/,
    /^(?:pub\s+)?struct\s+(\w+)/,
    /^(?:pub\s+)?enum\s+(\w+)/,
    /^(?:pub\s+)?trait\s+(\w+)/,
    /^impl(?:<[^>]+>)?\s+(\w+)/,
  ],
  java: [
    /^(?:public|private|protected)?\s*(?:static\s+)?(?:abstract\s+)?class\s+(\w+)/,
    /^(?:public|private|protected)?\s*(?:static\s+)?(?:abstract\s+)?interface\s+(\w+)/,
    /^(?:public|private|protected)?\s*(?:static\s+)?(?:synchronized\s+)?[\w<>\[\]]+\s+(\w+)\s*\(/,
  ],
  kotlin: [
    /^(?:fun|suspend\s+fun)\s+(?:<[^>]+>\s+)?(\w+)/,
    /^(?:data\s+)?class\s+(\w+)/,
    /^(?:object|interface)\s+(\w+)/,
  ],
};

// Alias common language IDs
const LANG_ALIASES: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', typescriptreact: 'typescript',
  js: 'javascript', jsx: 'javascript', javascriptreact: 'javascript',
  py: 'python',
  rs: 'rust',
  kt: 'kotlin',
};

function getPatterns(language: string): RegExp[] {
  const lang = LANG_ALIASES[language] || language;
  return BOUNDARY_PATTERNS[lang] || [];
}

/**
 * Split file content into chunks by function/class boundaries.
 * Falls back to fixed-size line splitting if no boundaries are detected.
 */
export function splitByBoundary(content: string, language: string, fallbackMaxLines: number = 200): Chunk[] {
  const lines = content.split('\n');
  const patterns = getPatterns(language);

  if (patterns.length === 0) {
    return splitByLines(lines, fallbackMaxLines);
  }

  const boundaries: { line: number; name: string; kind: Chunk['kind'] }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (match) {
        const kind: Chunk['kind'] = /class|struct|interface|trait|enum|type|impl|object/.test(trimmed)
          ? 'class' : 'function';
        boundaries.push({ line: i, name: match[1], kind });
        break;
      }
    }
  }

  if (boundaries.length === 0) {
    return splitByLines(lines, fallbackMaxLines);
  }

  const chunks: Chunk[] = [];

  for (let i = 0; i < boundaries.length; i++) {
    const start = boundaries[i].line;
    const end = i + 1 < boundaries.length ? boundaries[i + 1].line - 1 : lines.length - 1;
    const chunkLines = lines.slice(start, end + 1);

    chunks.push({
      startLine: start + 1,
      endLine: end + 1,
      name: boundaries[i].name,
      kind: boundaries[i].kind,
      content: chunkLines.join('\n'),
    });
  }

  // Include header (imports/comments before first boundary)
  if (boundaries[0].line > 0) {
    const headerLines = lines.slice(0, boundaries[0].line);
    if (headerLines.some((l) => l.trim().length > 0)) {
      chunks.unshift({
        startLine: 1,
        endLine: boundaries[0].line,
        name: 'header',
        kind: 'block',
        content: headerLines.join('\n'),
      });
    }
  }

  return chunks;
}

/**
 * Fallback: split by fixed line count.
 */
function splitByLines(lines: string[], maxLines: number): Chunk[] {
  const chunks: Chunk[] = [];
  for (let i = 0; i < lines.length; i += maxLines) {
    const end = Math.min(i + maxLines, lines.length);
    const chunkLines = lines.slice(i, end);
    chunks.push({
      startLine: i + 1,
      endLine: end,
      name: `chunk_${Math.floor(i / maxLines) + 1}`,
      kind: 'block',
      content: chunkLines.join('\n'),
    });
  }
  return chunks;
}
