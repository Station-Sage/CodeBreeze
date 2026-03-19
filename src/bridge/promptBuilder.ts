/**
 * Prompt Builder — Phase 9-1
 *
 * Builds structured prompts for Agent Loop iterations.
 * Combines error context, project rules, iteration history,
 * and related code into effective AI prompts.
 */
import * as fs from 'fs';
import * as path from 'path';
import { formatCodeBlock } from '../utils/markdown';
import { formatProjectRulesSection } from '../collect/rulesLoader';

export interface IterationRecord {
  iteration: number;
  errorSummary: string;
  appliedFiles: string[];
  buildExitCode: number;
  errorCount: number;
}

/**
 * Build a structured error-fix prompt for the first Agent Loop iteration.
 */
export function buildErrorFixPrompt(
  errorCount: number,
  contextPayload: string,
  chainContext: string
): string {
  const parts: string[] = [];

  // 1. Project rules
  const rules = formatProjectRulesSection();
  if (rules) parts.push(rules);

  // 2. Instructions
  parts.push(
    [
      `The build/test failed with ${errorCount} error(s). Please fix the following issues.`,
      '',
      'Requirements:',
      '- Return the corrected code as complete file(s) in markdown code blocks with file paths',
      '- Only modify files that need changes',
      '- Preserve existing code style and conventions',
    ].join('\n')
  );

  // 3. Error context
  if (contextPayload) parts.push(contextPayload);

  // 4. Related files (import chain)
  if (chainContext) parts.push(chainContext);

  return parts.filter(Boolean).join('\n\n');
}

/**
 * Build an iteration prompt that includes previous attempt history.
 * Prevents the AI from repeating the same mistakes.
 */
export function buildIterationPrompt(
  errorCount: number,
  contextPayload: string,
  chainContext: string,
  history: IterationRecord[]
): string {
  const parts: string[] = [];

  // 1. Project rules
  const rules = formatProjectRulesSection();
  if (rules) parts.push(rules);

  // 2. Instructions with history awareness
  parts.push(
    [
      `The build/test still fails with ${errorCount} error(s) after ${history.length} attempt(s).`,
      '',
      'IMPORTANT: Review the previous attempts below and avoid repeating the same fixes.',
      'Try a different approach if the previous fix did not resolve the issue.',
      '',
      'Requirements:',
      '- Return the corrected code as complete file(s) in markdown code blocks with file paths',
      '- Only modify files that need changes',
      '- Consider whether the error root cause is in a different file than reported',
    ].join('\n')
  );

  // 3. Previous iteration history
  if (history.length > 0) {
    const historyParts = history.map((h) =>
      [
        `### Attempt ${h.iteration}`,
        `- Errors: ${h.errorCount} (exit code: ${h.buildExitCode})`,
        `- Modified files: ${h.appliedFiles.join(', ') || 'none'}`,
        `- Error summary: ${h.errorSummary}`,
      ].join('\n')
    );

    parts.push('## Previous Attempts\n\n' + historyParts.join('\n\n'));
  }

  // 4. Current error context
  if (contextPayload) parts.push(contextPayload);

  // 5. Related files
  if (chainContext) parts.push(chainContext);

  return parts.filter(Boolean).join('\n\n');
}

/**
 * Build error chain context markdown from file paths.
 */
export function buildErrorChainMarkdown(
  errorFiles: string[],
  workspaceRoot: string,
  depth: number,
  getErrorChainFilesFn: (
    files: string[],
    root: string,
    d: number
  ) => Array<{ chainFiles: string[] }>
): string {
  if (errorFiles.length === 0 || depth === 0) return '';

  const chains = getErrorChainFilesFn(errorFiles, workspaceRoot, depth);
  const parts: string[] = ['### Related Files (import chain)'];

  for (const chain of chains) {
    for (const chainFile of chain.chainFiles.slice(0, 5)) {
      try {
        const content = fs.readFileSync(chainFile, 'utf8');
        const relPath = path.relative(workspaceRoot, chainFile);
        const ext = path.extname(chainFile).slice(1);
        const lines = content.split('\n');
        const truncated = lines.length > 50 ? lines.slice(0, 50).join('\n') + '\n// ...' : content;
        parts.push(formatCodeBlock(truncated, ext, relPath));
      } catch {
        // skip unreadable files
      }
    }
  }

  return parts.length > 1 ? parts.join('\n\n') : '';
}

/**
 * Summarize error diagnostics into a short string for iteration history.
 */
export function summarizeErrors(diagnosticItems: Array<{ file: string; message: string }>): string {
  if (diagnosticItems.length === 0) return 'no errors';
  const first3 = diagnosticItems.slice(0, 3);
  const summary = first3
    .map((d) => `${path.basename(d.file)}: ${d.message.slice(0, 60)}`)
    .join('; ');
  return diagnosticItems.length > 3 ? `${summary} (+${diagnosticItems.length - 3} more)` : summary;
}
