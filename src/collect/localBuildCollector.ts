import * as vscode from 'vscode';
import { spawnAsync } from '../utils/exec';
import { getConfig, getWorkspaceRoot } from '../config';
import { BuildResult, ParsedError } from '../types';
import { formatCodeBlock } from '../utils/markdown';
import * as fs from 'fs';

let lastBuildResult: BuildResult | null = null;
let outputChannel: vscode.OutputChannel | null = null;

export function getOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('CodeBreeze Build');
  }
  return outputChannel;
}

export async function runBuildAndCopy(): Promise<BuildResult | null> {
  const config = getConfig();
  const commands = config.buildCommands;
  if (!commands.length) {
    vscode.window.showErrorMessage('CodeBreeze: No build commands configured');
    return null;
  }

  const selected = commands.length === 1 ? commands[0] : await pickCommand(commands, 'build');
  if (!selected) return null;

  return runCommandAndCopy(selected);
}

export async function runTestAndCopy(): Promise<BuildResult | null> {
  const config = getConfig();
  const commands = config.testCommands;
  if (!commands.length) {
    vscode.window.showErrorMessage('CodeBreeze: No test commands configured');
    return null;
  }

  const selected = commands.length === 1 ? commands[0] : await pickCommand(commands, 'test');
  if (!selected) return null;

  return runCommandAndCopy(selected);
}

async function pickCommand(commands: string[], type: string): Promise<string | undefined> {
  return vscode.window.showQuickPick(commands, {
    placeHolder: `Select ${type} command`,
  });
}

export async function runCommandAndCopy(command: string): Promise<BuildResult | null> {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    vscode.window.showErrorMessage('CodeBreeze: No workspace open');
    return null;
  }

  const channel = getOutputChannel();
  channel.clear();
  channel.show(true);
  channel.appendLine(`$ ${command}`);
  channel.appendLine('');

  const startTime = Date.now();
  vscode.window.showInformationMessage(`CodeBreeze: Running "${command}"...`);

  const result = await spawnAsync(command, [], workspaceRoot, (data) => {
    channel.append(data);
  });

  const duration = (Date.now() - startTime) / 1000;
  const errors = parseErrors(result.stdout + result.stderr, workspaceRoot);

  const buildResult: BuildResult = {
    command,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    duration,
    errors,
    timestamp: Date.now(),
  };

  lastBuildResult = buildResult;

  const markdown = buildResultToMarkdown(buildResult, workspaceRoot);
  await vscode.env.clipboard.writeText(markdown);

  const status = result.exitCode === 0 ? 'succeeded' : 'FAILED';
  const msg = `CodeBreeze: Build ${status} (${duration.toFixed(1)}s) — copied to clipboard`;
  if (result.exitCode === 0) {
    vscode.window.showInformationMessage(msg);
  } else {
    vscode.window.showWarningMessage(msg);
  }

  return buildResult;
}

export function copyLastBuildLog(): void {
  if (!lastBuildResult) {
    vscode.window.showInformationMessage('CodeBreeze: No build log available');
    return;
  }

  const workspaceRoot = getWorkspaceRoot() || '';
  const markdown = buildResultToMarkdown(lastBuildResult, workspaceRoot);
  vscode.env.clipboard.writeText(markdown);
  vscode.window.showInformationMessage('CodeBreeze: Last build log copied to clipboard');
}

function buildResultToMarkdown(result: BuildResult, workspaceRoot: string): string {
  const status = result.exitCode === 0 ? 'SUCCESS' : 'FAILED';
  const lines: string[] = [
    `## Build Log (${result.command})`,
    `**Status**: ${status} (exit code ${result.exitCode})`,
    `**Duration**: ${result.duration.toFixed(1)}s`,
    '',
  ];

  if (result.errors.length > 0) {
    lines.push('### Errors & Warnings');
    lines.push('');
    for (const err of result.errors) {
      lines.push(`- \`${err.filePath}:${err.line}\` [${err.severity}] ${err.message}`);
      if (err.codeContext) {
        lines.push(formatCodeBlock(err.codeContext, '', `${err.filePath}:${err.line}`));
      }
    }
    lines.push('');
  }

  const combinedOutput = (result.stdout + result.stderr).trim();
  if (combinedOutput) {
    lines.push('### Full Output');
    lines.push(formatCodeBlock(combinedOutput, ''));
  }

  return lines.join('\n');
}

function parseErrors(output: string, workspaceRoot: string): ParsedError[] {
  const errors: ParsedError[] = [];
  const patterns = [
    // TypeScript: src/file.ts(42,5): error TS2345
    /^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+(.+)$/gm,
    // Generic: src/file.ts:42:5: error: ...
    /^(.+?):(\d+):(\d+):\s+(error|warning|note):\s+(.+)$/gm,
    // Rust/Go: --> src/file.rs:42:5
    /^.*?-->\s+(.+?):(\d+):(\d+)$/gm,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(output)) !== null) {
      const filePath = match[1].trim();
      const line = parseInt(match[2], 10);
      const severity = (match[4] || 'error').includes('warn') ? 'warning' : 'error';
      const message = match[5]?.trim() || '';

      const context = getCodeContext(`${workspaceRoot}/${filePath}`, line, 5);
      errors.push({ filePath, line, message, severity, codeContext: context || undefined });
    }
    if (errors.length > 0) break;
  }

  return errors;
}

function getCodeContext(fullPath: string, centerLine: number, contextLines: number): string | null {
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');
    const start = Math.max(0, centerLine - contextLines - 1);
    const end = Math.min(lines.length, centerLine + contextLines);
    return lines
      .slice(start, end)
      .map((line, i) => `${start + i + 1}: ${line}`)
      .join('\n');
  } catch {
    return null;
  }
}

export function getLastBuildResult(): BuildResult | null {
  return lastBuildResult;
}
