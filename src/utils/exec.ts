import * as cp from 'child_process';

export function execSync(command: string, cwd: string): string {
  try {
    return cp.execSync(command, { cwd, encoding: 'utf8', timeout: 30000 });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'stdout' in err) {
      return String((err as { stdout: string }).stdout || '');
    }
    return '';
  }
}

export function spawnAsync(
  command: string,
  args: string[],
  cwd: string,
  onData?: (data: string) => void
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const [cmd, ...cmdArgs] = command.split(' ');
    const allArgs = [...cmdArgs, ...args];

    const proc = cp.spawn(cmd, allArgs, { cwd, shell: true });

    proc.stdout.on('data', (data: Buffer) => {
      const text = data.toString();
      stdout.push(text);
      onData?.(text);
    });

    proc.stderr.on('data', (data: Buffer) => {
      const text = data.toString();
      stderr.push(text);
      onData?.(text);
    });

    proc.on('close', (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout: stdout.join(''),
        stderr: stderr.join(''),
      });
    });

    proc.on('error', (err) => {
      resolve({ exitCode: 1, stdout: '', stderr: err.message });
    });
  });
}
