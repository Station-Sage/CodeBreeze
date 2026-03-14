import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface CodeBreezeConfig {
  filePathPattern: string;
  sourceRoot: string;
  gitDiffMode: 'staged' | 'unstaged' | 'both';
  githubToken: string;
  githubRepo: string;
  contextLines: number;
  chunkMaxLines: number;
  watchClipboard: boolean;
  gitLogCount: number;
  buildCommands: string[];
  testCommands: string[];
  chatUrl: string;
  autoLevel: 'off' | 'notify' | 'auto';
  autoWatchClipboard: boolean;
}

const LOCAL_CONFIG_FILE = '.codebreeze.json';

export function getConfig(): CodeBreezeConfig {
  const vsConfig = vscode.workspace.getConfiguration('codebreeze');
  const base: CodeBreezeConfig = {
    filePathPattern: vsConfig.get('filePathPattern', ''),
    sourceRoot: vsConfig.get('sourceRoot', ''),
    gitDiffMode: vsConfig.get('gitDiffMode', 'unstaged'),
    githubToken: vsConfig.get('githubToken', ''),
    githubRepo: vsConfig.get('githubRepo', ''),
    contextLines: vsConfig.get('contextLines', 15),
    chunkMaxLines: vsConfig.get('chunkMaxLines', 200),
    watchClipboard: vsConfig.get('watchClipboard', false),
    gitLogCount: vsConfig.get('gitLogCount', 10),
    buildCommands: vsConfig.get('buildCommands', ['npm run build']),
    testCommands: vsConfig.get('testCommands', ['npm test']),
    chatUrl: vsConfig.get('chatUrl', 'https://www.genspark.ai/agents?type=ai_chat'),
    autoLevel: vsConfig.get('autoLevel', 'notify'),
    autoWatchClipboard: vsConfig.get('autoWatchClipboard', false),
  };

  const workspaceRoot = getWorkspaceRoot();
  if (workspaceRoot) {
    const localConfigPath = path.join(workspaceRoot, LOCAL_CONFIG_FILE);
    if (fs.existsSync(localConfigPath)) {
      try {
        const localConfig = JSON.parse(fs.readFileSync(localConfigPath, 'utf8'));
        return { ...base, ...localConfig };
      } catch {
        // ignore parse errors
      }
    }
  }

  return base;
}

export function getWorkspaceRoot(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}
