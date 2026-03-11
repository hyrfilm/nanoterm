import { createDefaultFS } from './defaultFs';
import type { DirNode } from './types';

export function serializeFSState(root: DirNode, cwd: string): string {
  return JSON.stringify({
    root,
    cwd,
  });
}

export function loadFSStateFromLocalStorage(key: string): { root: DirNode; cwd: string } | null {
  if (typeof localStorage === 'undefined') return null;

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw, (jsonKey, value) => {
      if ((jsonKey === 'createdAt' || jsonKey === 'modifiedAt') && typeof value === 'string') {
        return new Date(value);
      }
      return value;
    }) as Partial<{ root: DirNode; cwd: string }>;
    if (!parsed.root || parsed.root.type !== 'directory' || typeof parsed.cwd !== 'string') {
      return null;
    }
    return {
      root: parsed.root,
      cwd: parsed.cwd,
    };
  } catch {
    return null;
  }
}

export function saveFSStateToLocalStorage(key: string, root: DirNode, cwd: string): void {
  if (typeof localStorage === 'undefined') return;

  try {
    localStorage.setItem(key, serializeFSState(root, cwd));
  } catch {
    // Best-effort persistence only.
  }
}

export function createInitialFSState(): { root: DirNode; cwd: string } {
  return {
    root: createDefaultFS(),
    cwd: '/home/guest',
  };
}
