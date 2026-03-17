/**
 * Pure error-output parser — no vscode dependency.
 * Extracted from localBuildCollector for testability.
 */

export interface ParsedErrorInfo {
  filePath: string;
  line: number;
  message: string;
  severity: 'error' | 'warning';
}

interface PatternDef {
  regex: RegExp;
  fileIdx: number;
  lineIdx: number;
  sevIdx: number | null;
  msgIdx: number | null;
}

const PATTERNS: PatternDef[] = [
  // TypeScript: src/file.ts(42,5): error TS2345: message
  { regex: /^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(.+)$/gm, fileIdx: 1, lineIdx: 2, sevIdx: 4, msgIdx: 5 },
  // ESLint/Generic: src/file.ts:42:5: error: ...
  { regex: /^(.+?):(\d+):(\d+):\s+(error|warning|note):\s+(.+)$/gm, fileIdx: 1, lineIdx: 2, sevIdx: 4, msgIdx: 5 },
  // GCC/Clang: src/file.c:42:5: error: undeclared identifier
  { regex: /^(.+?\.[ch](?:pp|xx)?):(\d+):(\d+):\s+(error|warning|fatal error):\s+(.+)$/gm, fileIdx: 1, lineIdx: 2, sevIdx: 4, msgIdx: 5 },
  // Java/Kotlin: src/File.java:42: error: ...
  { regex: /^(.+?\.(?:java|kt|kts)):(\d+):\s+(error|warning):\s+(.+)$/gm, fileIdx: 1, lineIdx: 2, sevIdx: 3, msgIdx: 4 },
  // Python traceback: File "src/file.py", line 42
  { regex: /^\s*File "(.+?)", line (\d+)/gm, fileIdx: 1, lineIdx: 2, sevIdx: null, msgIdx: null },
  // Rust/Go: --> src/file.rs:42:5
  { regex: /^.*?-->\s+(.+?):(\d+):(\d+)$/gm, fileIdx: 1, lineIdx: 2, sevIdx: null, msgIdx: null },
  // Gradle/Maven: e: file:///path/File.kt:42:5 message
  { regex: /^e:\s+(?:file:\/\/)?(.+?):(\d+):(\d+)\s+(.+)$/gm, fileIdx: 1, lineIdx: 2, sevIdx: null, msgIdx: 4 },
  // Swift: src/file.swift:42:5: error: ...
  { regex: /^(.+?\.swift):(\d+):(\d+):\s+(error|warning):\s+(.+)$/gm, fileIdx: 1, lineIdx: 2, sevIdx: 4, msgIdx: 5 },
];

/**
 * Parse build/compile output to extract structured error info.
 * Tries each pattern group in priority order; stops at the first group that matches.
 * Deduplicates by file:line:message key.
 */
export function parseErrorOutput(output: string): ParsedErrorInfo[] {
  const errors: ParsedErrorInfo[] = [];
  const seen = new Set<string>();

  for (const { regex, fileIdx, lineIdx, sevIdx, msgIdx } of PATTERNS) {
    let match: RegExpExecArray | null;
    regex.lastIndex = 0;
    while ((match = regex.exec(output)) !== null) {
      const filePath = match[fileIdx].trim();
      const line = parseInt(match[lineIdx], 10);
      const sevRaw = sevIdx !== null ? match[sevIdx] : 'error';
      const severity: 'error' | 'warning' = (sevRaw || 'error').includes('warn') ? 'warning' : 'error';
      const message = msgIdx !== null ? (match[msgIdx]?.trim() || '') : '';

      const key = `${filePath}:${line}:${message}`;
      if (seen.has(key)) continue;
      seen.add(key);

      errors.push({ filePath, line, message, severity });
    }
    if (errors.length > 0) break;
  }

  return errors;
}
