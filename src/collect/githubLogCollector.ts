import * as vscode from 'vscode';
import * as https from 'https';
import AdmZip from 'adm-zip';
import { getConfig } from '../config';
import { getLastBuildResult } from './localBuildCollector';

export async function copyBuildLogFromGitHub(): Promise<void> {
  // Prefer local build log if available
  const localResult = getLastBuildResult();
  if (localResult) {
    const useLocal = await vscode.window.showQuickPick(
      ['Use local build log', 'Fetch from GitHub Actions'],
      { placeHolder: 'A local build log is available' }
    );
    if (useLocal === 'Use local build log') {
      await vscode.commands.executeCommand('codebreeze.copyLastBuildLog');
      return;
    }
  }

  const config = getConfig();
  if (!config.githubToken || !config.githubRepo) {
    vscode.window.showErrorMessage(
      'CodeBreeze: Set codebreeze.githubToken and codebreeze.githubRepo in settings'
    );
    return;
  }

  try {
    vscode.window.showInformationMessage('CodeBreeze: Fetching GitHub Actions logs...');
    const log = await fetchFailedJobLog(config.githubToken, config.githubRepo);

    if (!log) {
      vscode.window.showInformationMessage('CodeBreeze: No failed workflow runs found');
      return;
    }

    await vscode.env.clipboard.writeText(log);
    vscode.window.showInformationMessage('CodeBreeze: GitHub Actions log copied to clipboard');
  } catch (err) {
    vscode.window.showErrorMessage(
      `CodeBreeze: Failed to fetch GitHub log: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

async function fetchFailedJobLog(token: string, repo: string): Promise<string | null> {
  const runsData = await githubGet(`/repos/${repo}/actions/runs?status=failure&per_page=5`, token);
  const runs = (runsData as { workflow_runs?: Array<{ id: number; name: string; head_branch: string }> }).workflow_runs;

  if (!runs || runs.length === 0) return null;

  const run = runs[0];
  const jobsData = await githubGet(`/repos/${repo}/actions/runs/${run.id}/jobs`, token);
  const jobs = (jobsData as { jobs?: Array<{ id: number; name: string; conclusion: string }> }).jobs;
  const failedJob = jobs?.find((j) => j.conclusion === 'failure');

  if (!failedJob) return null;

  const logBuffer = await githubGetBuffer(
    `/repos/${repo}/actions/jobs/${failedJob.id}/logs`,
    token
  );

  let logText: string;
  try {
    const zip = new AdmZip(logBuffer);
    const entries = zip.getEntries();
    logText = entries.map((e) => e.getData().toString('utf8')).join('\n');
  } catch {
    logText = logBuffer.toString('utf8');
  }

  // Extract error lines only
  const errorLines = logText
    .split('\n')
    .filter((line) =>
      /error|FAILED|Error:|failed/i.test(line) && !line.includes('##[group]')
    )
    .slice(0, 50)
    .join('\n');

  return [
    `## GitHub Actions Build Log`,
    `**Run**: ${run.name} (${run.head_branch})`,
    `**Job**: ${failedJob.name}`,
    '',
    '### Errors',
    '```',
    errorLines || '(no specific error lines extracted)',
    '```',
  ].join('\n');
}

function githubGet(path: string, token: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path,
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'codebreeze-vscode',
        Accept: 'application/vnd.github.v3+json',
      },
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk: string) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Failed to parse GitHub API response`));
        }
      });
    }).on('error', reject);
  });
}

function githubGetBuffer(path: string, token: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path,
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': 'codebreeze-vscode',
        Accept: 'application/vnd.github.v3+json',
      },
    };

    https.get(options, (res) => {
      // Handle redirect
      if (res.statusCode === 302 && res.headers.location) {
        const url = new URL(res.headers.location);
        https.get(res.headers.location, (res2) => {
          const chunks: Buffer[] = [];
          res2.on('data', (chunk: Buffer) => chunks.push(chunk));
          res2.on('end', () => resolve(Buffer.concat(chunks)));
        }).on('error', reject);
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}
