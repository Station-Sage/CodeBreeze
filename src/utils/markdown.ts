export function formatCodeBlock(content: string, language: string, filePath?: string): string {
  const header = filePath ? `${language}:${filePath}` : language;
  return `\`\`\`${header}\n${content}\n\`\`\``;
}

export function formatSection(title: string, content: string): string {
  return `## ${title}\n\n${content}\n`;
}

export function truncateLines(text: string, maxLines: number): string {
  const lines = text.split('\n');
  if (lines.length <= maxLines) {
    return text;
  }
  const half = Math.floor(maxLines / 2);
  const kept = [...lines.slice(0, half), `... (${lines.length - maxLines} lines omitted) ...`, ...lines.slice(lines.length - half)];
  return kept.join('\n');
}

export function getLineRange(text: string, centerLine: number, contextLines: number): string {
  const lines = text.split('\n');
  const start = Math.max(0, centerLine - contextLines - 1);
  const end = Math.min(lines.length, centerLine + contextLines);
  return lines
    .slice(start, end)
    .map((line, i) => `${start + i + 1}: ${line}`)
    .join('\n');
}
