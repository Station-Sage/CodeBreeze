/**
 * Fix with AI — Phase 8-3
 *
 * One-click error fix workflow:
 * Error → AI context → Bridge/Clipboard → Response → Diff preview
 */
import * as vscode from 'vscode';
import * as fs from 'fs';
import { getDiagnosticsMarkdown } from '../collect/errorCollector';
import { getErrorChainFiles } from '../collect/errorChainCollector';
import { formatProjectRulesSection } from '../collect/rulesLoader';
import { getConfig, getWorkspaceRoot } from '../config';
import { formatCodeBlock } from '../utils/markdown';
import { writeClipboard } from '../utils/clipboardCompat';
import * as path from 'path';

/**
 * Build a structured error-fix prompt from current diagnostics + code context.
 */
function buildErrorFixPrompt(): string {
  const parts: string[] = [];
  const config = getConfig();
  const workspaceRoot = getWorkspaceRoot() || '';

  // 1. Project rules
  const rules = formatProjectRulesSection();
  if (rules) parts.push(rules);

  // 2. Error diagnostics
  const errorsMarkdown = getDiagnosticsMarkdown();
  if (errorsMarkdown) {
    parts.push('## Errors to Fix\n\n' + errorsMarkdown);
  }

  // 3. Current editor context (if on an error line)
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    const doc = editor.document;
    const relPath = vscode.workspace.asRelativePath(doc.uri);
    const diagnostics = vscode.languages.getDiagnostics(doc.uri);
    const errors = diagnostics.filter((d) => d.severity === vscode.DiagnosticSeverity.Error);

    if (errors.length > 0) {
      parts.push(`## File with Errors: ${relPath}`);
      parts.push(formatCodeBlock(doc.getText(), doc.languageId, relPath));
    }
  }

  // 4. Error chain (related files)
  const allDiags = vscode.languages.getDiagnostics();
  const errorFiles: string[] = [];
  for (const [uri, diagnostics] of allDiags) {
    if (diagnostics.some((d) => d.severity === vscode.DiagnosticSeverity.Error)) {
      errorFiles.push(uri.fsPath);
    }
  }

  if (errorFiles.length > 0 && config.errorChainDepth > 0) {
    const chains = getErrorChainFiles(errorFiles, workspaceRoot, config.errorChainDepth);
    const chainParts: string[] = [];
    for (const chain of chains) {
      for (const chainFile of chain.chainFiles.slice(0, 3)) {
        try {
          const content = fs.readFileSync(chainFile, 'utf8');
          const relPath = path.relative(workspaceRoot, chainFile);
          const ext = path.extname(chainFile).slice(1);
          const lines = content.split('\n');
          const truncated =
            lines.length > 50 ? lines.slice(0, 50).join('\n') + '\n// ...' : content;
          chainParts.push(formatCodeBlock(truncated, ext, relPath));
        } catch {
          /* skip */
        }
      }
    }
    if (chainParts.length > 0) {
      parts.push('## Related Files (import chain)\n\n' + chainParts.join('\n\n'));
    }
  }

  // 5. Instruction
  parts.unshift(
    'Please fix the following errors. Return the corrected code as complete file(s) in markdown code blocks with file paths.'
  );

  return parts.filter(Boolean).join('\n\n');
}

/**
 * Execute the Fix with AI command.
 * - If bridge is connected: sends to AI automatically, waits for response
 * - If bridge is not connected: copies to clipboard with instructions
 */
export async function fixErrorWithAI(): Promise<void> {
  const prompt = buildErrorFixPrompt();

  if (!prompt || prompt.length < 50) {
    vscode.window.showInformationMessage('CodeBreeze: No errors detected to fix');
    return;
  }

  try {
    const { isWsBridgeRunning, broadcastToBrowser } = await import('../bridge/wsBridgeServer');

    if (isWsBridgeRunning()) {
      // Bridge connected: send to AI automatically
      broadcastToBrowser({ type: 'send_to_ai', payload: prompt, autoSend: true }, true);
      vscode.window.showInformationMessage(
        'CodeBreeze: Error context sent to AI via bridge. Waiting for fix...'
      );
    } else {
      // No bridge: copy to clipboard
      await writeClipboard(prompt);
      vscode.window
        .showInformationMessage(
          'CodeBreeze: Error context copied to clipboard. Paste into AI chat, then use Ctrl+Shift+A to apply the fix.',
          'Open AI Chat'
        )
        .then((choice) => {
          if (choice === 'Open AI Chat') {
            const config = getConfig();
            vscode.env.openExternal(vscode.Uri.parse(config.chatUrl));
          }
        });
    }
  } catch {
    // Bridge module not available — clipboard fallback
    await writeClipboard(prompt);
    vscode.window.showInformationMessage(
      'CodeBreeze: Error context copied. Paste into AI chat, then Ctrl+Shift+A to apply.'
    );
  }
}
