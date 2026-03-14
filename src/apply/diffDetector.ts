export type ContentType = 'diff' | 'codeblock' | 'mixed' | 'plain';

export function detectContentType(text: string): ContentType {
  const hasDiff =
    /^diff --git/m.test(text) ||
    (/^---\s/m.test(text) && /^\+\+\+\s/m.test(text) && /^@@/m.test(text));
  const hasCodeBlock = /^```/m.test(text);

  if (hasDiff && hasCodeBlock) return 'mixed';
  if (hasDiff) return 'diff';
  if (hasCodeBlock) return 'codeblock';
  return 'plain';
}

export function extractDiffPatches(text: string): string[] {
  const patches: string[] = [];
  const lines = text.split('\n');
  let current: string[] = [];
  let inPatch = false;

  for (const line of lines) {
    if (line.startsWith('diff --git') || (line.startsWith('---') && !inPatch)) {
      if (current.length > 0) {
        patches.push(current.join('\n'));
      }
      current = [line];
      inPatch = true;
    } else if (inPatch) {
      current.push(line);
    }
  }

  if (current.length > 0) {
    patches.push(current.join('\n'));
  }

  return patches;
}
