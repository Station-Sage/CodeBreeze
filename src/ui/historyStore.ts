import * as vscode from 'vscode';
import { HistoryEntry, ApplyResult } from '../types';

const MAX_HISTORY = 20;
let entries: HistoryEntry[] = [];
let context: vscode.ExtensionContext | null = null;

const STORAGE_KEY = 'codebreeze.history';

export function initHistoryStore(ctx: vscode.ExtensionContext): void {
  context = ctx;
  const stored = ctx.workspaceState.get<HistoryEntry[]>(STORAGE_KEY, []);
  entries = stored.slice(0, MAX_HISTORY);
}

export function addHistoryEntry(results: ApplyResult[], stashRef?: string): HistoryEntry {
  const entry: HistoryEntry = {
    id: Date.now().toString(),
    timestamp: Date.now(),
    results,
    undoAvailable: stashRef !== undefined || results.some((r) => r.status === 'applied'),
    stashRef,
  };

  entries.unshift(entry);
  if (entries.length > MAX_HISTORY) {
    entries = entries.slice(0, MAX_HISTORY);
  }

  context?.workspaceState.update(STORAGE_KEY, entries);
  return entry;
}

export function getHistory(): HistoryEntry[] {
  return entries;
}

export function clearHistory(): void {
  entries = [];
  context?.workspaceState.update(STORAGE_KEY, []);
}
