import type { VirtualFS } from './filesystem';

type OverlayTree = Record<string, unknown>;

export interface FSOverlay {
  json: OverlayTree;
  text: OverlayTree;
  binary: OverlayTree;
}

export const emptyOverlay: FSOverlay = {
  json: {},
  text: {},
  binary: {},
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeOverlay(value: unknown): FSOverlay {
  if (!isObject(value)) return emptyOverlay;
  return {
    json: isObject(value.json) ? value.json : {},
    text: isObject(value.text) ? value.text : {},
    binary: isObject(value.binary) ? value.binary : {},
  };
}

export function parseOverlayJson(rawJson: string): FSOverlay {
  try {
    return normalizeOverlay(JSON.parse(rawJson));
  } catch {
    return emptyOverlay;
  }
}

function joinPath(parent: string, segment: string): string {
  if (!parent) return `/${segment}`;
  return `${parent}/${segment}`;
}

function ensureParentDirectory(fs: VirtualFS, absolutePath: string): void {
  const lastSlash = absolutePath.lastIndexOf('/');
  const parentPath = lastSlash <= 0 ? '/' : absolutePath.slice(0, lastSlash);
  fs.createDirectory(parentPath, true);
}

function writeOverlayFile(fs: VirtualFS, absolutePath: string, content: string): void {
  ensureParentDirectory(fs, absolutePath);
  fs.writeFile(absolutePath, content);
}

function applyTextTree(fs: VirtualFS, tree: unknown, currentPath = ''): void {
  if (!isObject(tree)) return;
  for (const [name, value] of Object.entries(tree)) {
    const nextPath = joinPath(currentPath, name);
    if (typeof value === 'string') {
      writeOverlayFile(fs, nextPath, value);
    } else {
      applyTextTree(fs, value, nextPath);
    }
  }
}

function decodeBase64ToBinaryString(value: string): string {
  if (typeof atob === 'function') {
    try {
      return atob(value);
    } catch {
      return value;
    }
  }

  const bufferCtor = (globalThis as { Buffer?: { from: (input: string, encoding: string) => { toString: (format: string) => string } } }).Buffer;
  if (bufferCtor) {
    try {
      return bufferCtor.from(value, 'base64').toString('binary');
    } catch {
      return value;
    }
  }

  return value;
}

function applyBinaryTree(fs: VirtualFS, tree: unknown, currentPath = ''): void {
  if (!isObject(tree)) return;
  for (const [name, value] of Object.entries(tree)) {
    const nextPath = joinPath(currentPath, name);
    if (typeof value === 'string') {
      writeOverlayFile(fs, nextPath, decodeBase64ToBinaryString(value));
    } else {
      applyBinaryTree(fs, value, nextPath);
    }
  }
}

function applyJsonTree(fs: VirtualFS, tree: unknown, currentPath = ''): void {
  if (!isObject(tree)) return;
  for (const [name, value] of Object.entries(tree)) {
    const nextPath = joinPath(currentPath, name);
    if (name.endsWith('.json')) {
      writeOverlayFile(fs, nextPath, JSON.stringify(value, null, 2));
      continue;
    }
    if (isObject(value)) {
      applyJsonTree(fs, value, nextPath);
      continue;
    }
    writeOverlayFile(fs, nextPath, JSON.stringify(value, null, 2));
  }
}

export function applyFSOverlay(fs: VirtualFS, overlay: FSOverlay | null | undefined): void {
  if (!overlay) return;
  applyJsonTree(fs, overlay.json);
  applyTextTree(fs, overlay.text);
  applyBinaryTree(fs, overlay.binary);
}
