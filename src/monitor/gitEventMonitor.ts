import * as vscode from 'vscode';
import { getConfig } from '../config';

type GitChangeCallback = (event: 'commit' | 'stage' | 'branch') => void;
const listeners: GitChangeCallback[] = [];

export function onGitChange(cb: GitChangeCallback): vscode.Disposable {
  listeners.push(cb);
  return {
    dispose: () => {
      const idx = listeners.indexOf(cb);
      if (idx >= 0) listeners.splice(idx, 1);
    },
  };
}

export function registerGitEventMonitor(context: vscode.ExtensionContext): void {
  const gitExt = vscode.extensions.getExtension('vscode.git');
  if (!gitExt) return;

  const activate = async () => {
    if (!gitExt.isActive) {
      await gitExt.activate();
    }

    const git = gitExt.exports?.getAPI?.(1);
    if (!git) return;

    const setupRepo = (repo: {
      state: {
        onDidChange: (cb: () => void) => vscode.Disposable;
        HEAD?: { name?: string; commit?: string };
      };
    }) => {
      let prevBranch = repo.state.HEAD?.name;
      let prevCommit = repo.state.HEAD?.commit || '';

      const sub = repo.state.onDidChange(() => {
        const config = getConfig();
        if (config.autoLevel === 'off') return;

        const currentBranch = repo.state.HEAD?.name;
        const currentCommit = repo.state.HEAD?.commit || '';

        if (currentBranch !== prevBranch) {
          prevBranch = currentBranch;
          listeners.forEach((cb) => cb('branch'));
          vscode.window.showInformationMessage(`CodeBreeze: Switched to branch "${currentBranch}"`);
        } else if (currentCommit && currentCommit !== prevCommit) {
          prevCommit = currentCommit;
          listeners.forEach((cb) => cb('commit'));
          vscode.window.showInformationMessage(`CodeBreeze: New commit on "${currentBranch}"`);
        }
      });

      context.subscriptions.push(sub);
    };

    git.repositories.forEach(setupRepo);

    const repoSub = git.onDidOpenRepository(setupRepo);
    context.subscriptions.push(repoSub);
  };

  activate();
}
