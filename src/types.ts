export interface CodeBlock {
  language: string;
  filePath: string | null;
  content: string;
  isDiff: boolean;
}

export interface ApplyResult {
  filePath: string;
  status: 'applied' | 'created' | 'skipped' | 'failed';
  error?: string;
}

export interface HistoryEntry {
  id: string;
  timestamp: number;
  results: ApplyResult[];
  undoAvailable: boolean;
  stashRef?: string;
}

export interface BuildResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
  errors: ParsedError[];
  timestamp: number;
}

export interface ParsedError {
  filePath: string;
  line: number;
  column?: number;
  message: string;
  severity: 'error' | 'warning';
  codeContext?: string;
}

export interface ContextPayload {
  type: 'file' | 'selection' | 'errors' | 'gitDiff' | 'gitLog' | 'buildLog' | 'smartContext';
  content: string;
  label: string;
}

export interface MonitorEvent {
  source: 'task' | 'terminal' | 'diagnostics' | 'git';
  type: 'build_start' | 'build_end' | 'test_start' | 'test_end' | 'error' | 'commit' | 'push';
  data: unknown;
  timestamp: number;
}
