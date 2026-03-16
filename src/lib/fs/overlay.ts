import type { DirNode, FSNode } from './types';
import { isDir, isFile } from './types';

type OverlayTree = Record<string, unknown>;
type OverlayType = 'text' | 'json' | 'base64';
type OverlayOp = { '+': string } | { '-': string };

export interface FSOverlay {
  '/': OverlayTree;
  _?: {
    types?: OverlayTree;
    ops?: OverlayOp[];
  };
}

export const emptyOverlay: FSOverlay = {
  '/': {},
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isKnownType(value: unknown): value is OverlayType {
  return value === 'text' || value === 'json' || value === 'base64';
}

function isEmptyObject(value: OverlayTree): boolean {
  return Object.keys(value).length === 0;
}

function objectWithoutKeys(value: Record<string, unknown>, keys: string[]): OverlayTree {
  const next: OverlayTree = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!keys.includes(key)) {
      next[key] = entry;
    }
  }
  return next;
}

function normalizeRootTree(value: unknown): OverlayTree {
  if (!isObject(value)) return {};
  if (isObject(value['/'])) return value['/'];
  return objectWithoutKeys(value, ['_']);
}

function normalizeOps(value: unknown): OverlayOp[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const ops: OverlayOp[] = [];
  for (const item of value) {
    if (!isObject(item)) continue;
    if (typeof item['+'] === 'string') {
      ops.push({ '+': item['+'] });
      continue;
    }
    if (typeof item['-'] === 'string') {
      ops.push({ '-': item['-'] });
    }
  }

  return ops.length > 0 ? ops : undefined;
}

function normalizeMeta(value: unknown): FSOverlay['_'] | undefined {
  if (Array.isArray(value)) {
    const ops = normalizeOps(value);
    return ops ? { ops } : undefined;
  }

  if (!isObject(value)) return undefined;

  const types = normalizeRootTree(value.types);
  const ops = normalizeOps(value.ops);

  if (isEmptyObject(types) && !ops) {
    return undefined;
  }

  const meta: NonNullable<FSOverlay['_']> = {};
  if (!isEmptyObject(types)) {
    meta.types = { '/': types };
  }
  if (ops) {
    meta.ops = ops;
  }
  return meta;
}

function joinPath(parent: string, segment: string): string {
  if (!parent) return `/${segment}`;
  return `${parent}/${segment}`;
}

function ensureParentDirectory(
  fs: {
    createDirectory(path: string, recursive?: boolean): { ok: true } | { ok: false; error: string };
    writeFile(path: string, content: string): { ok: true } | { ok: false; error: string };
  },
  absolutePath: string,
): void {
  const lastSlash = absolutePath.lastIndexOf('/');
  const parentPath = lastSlash <= 0 ? '/' : absolutePath.slice(0, lastSlash);
  fs.createDirectory(parentPath, true);
}

function writeOverlayFile(
  fs: {
    createDirectory(path: string, recursive?: boolean): { ok: true } | { ok: false; error: string };
    writeFile(path: string, content: string): { ok: true } | { ok: false; error: string };
  },
  absolutePath: string,
  content: string,
): void {
  ensureParentDirectory(fs, absolutePath);
  fs.writeFile(absolutePath, content);
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

function encodeBinaryStringToBase64(value: string): string {
  const bufferCtor = (globalThis as { Buffer?: { from: (input: string, encoding: string) => { toString: (format: string) => string } } }).Buffer;
  if (bufferCtor) {
    return bufferCtor.from(value, 'binary').toString('base64');
  }

  if (typeof btoa === 'function') {
    return btoa(value);
  }

  return value;
}

function bytesToBase64(bytes: Uint8Array): string {
  const bufferCtor = (globalThis as { Buffer?: { from: (input: Uint8Array) => { toString: (format: string) => string } } }).Buffer;
  if (bufferCtor) {
    return bufferCtor.from(bytes).toString('base64');
  }

  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const bufferCtor = (globalThis as { Buffer?: { from: (input: string, encoding: string) => Uint8Array } }).Buffer;
  if (bufferCtor) {
    return new Uint8Array(bufferCtor.from(value, 'base64'));
  }

  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function encodeBase64Url(value: string): string {
  return value.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return normalized + padding;
}

function looksBinaryString(value: string): boolean {
  return value.includes('\u0000');
}

function normalizeOverlay(value: unknown): FSOverlay {
  if (!isObject(value)) return emptyOverlay;

  const meta = normalizeMeta(value._);
  const overlay: FSOverlay = {
    '/': normalizeRootTree(value),
  };

  if (meta) {
    overlay._ = meta;
  }

  return overlay;
}

export function parseOverlayJson(rawJson: string): FSOverlay {
  try {
    return normalizeOverlay(JSON.parse(rawJson));
  } catch {
    return emptyOverlay;
  }
}

export function encodeOverlayForUrl(overlay: FSOverlay): string {
  return encodeBase64Url(bytesToBase64(textEncoder.encode(JSON.stringify(overlay))));
}

export function parseOverlayParam(rawValue: string | null | undefined): FSOverlay {
  if (!rawValue) return emptyOverlay;

  try {
    const json = textDecoder.decode(base64ToBytes(decodeBase64Url(rawValue)));
    return parseOverlayJson(json);
  } catch {
    return parseOverlayJson(rawValue);
  }
}

function encodeDefaultLeaf(value: unknown): string {
  if (typeof value === 'string') return value;
  const json = JSON.stringify(value, null, 2);
  return json ?? String(value);
}

function encodeTypedLeaf(value: unknown, type: OverlayType): string {
  if (type === 'json') {
    return JSON.stringify(value, null, 2);
  }
  if (type === 'base64') {
    return typeof value === 'string' ? decodeBase64ToBinaryString(value) : encodeDefaultLeaf(value);
  }
  return encodeDefaultLeaf(value);
}

function typeForNode(value: unknown): OverlayType | undefined {
  return isKnownType(value) ? value : undefined;
}

function collectOverlayEntries(
  tree: OverlayTree,
  typeTree: unknown,
  currentPath: string,
  entries: Array<{ path: string; content: string }>,
): void {
  for (const [name, value] of Object.entries(tree)) {
    if (name === '_') continue;

    const nextPath = joinPath(currentPath, name);
    const typeNode = isObject(typeTree) ? typeTree[name] : undefined;
    const declaredType = typeForNode(typeNode);

    if (declaredType) {
      entries.push({ path: nextPath, content: encodeTypedLeaf(value, declaredType) });
      continue;
    }

    if (typeof value === 'string') {
      entries.push({ path: nextPath, content: value });
      continue;
    }

    if (isObject(value)) {
      collectOverlayEntries(value, typeNode, nextPath, entries);
      continue;
    }

    entries.push({ path: nextPath, content: encodeDefaultLeaf(value) });
  }
}

function matchesOp(path: string, pattern: string): boolean {
  return path.includes(pattern);
}

function applyOps(
  entries: Array<{ path: string; content: string }>,
  ops: OverlayOp[] | undefined,
): Array<{ path: string; content: string }> {
  if (!ops || ops.length === 0) return entries;

  const visible = new Set(entries.map((entry) => entry.path));

  for (const op of ops) {
    if ('-' in op) {
      for (const entry of entries) {
        if (matchesOp(entry.path, op['-'])) {
          visible.delete(entry.path);
        }
      }
      continue;
    }

    for (const entry of entries) {
      if (matchesOp(entry.path, op['+'])) {
        visible.add(entry.path);
      }
    }
  }

  return entries.filter((entry) => visible.has(entry.path));
}

export function forEachOverlayFile(
  overlay: FSOverlay | null | undefined,
  visit: (absolutePath: string, content: string) => void,
): void {
  if (!overlay) return;

  const entries: Array<{ path: string; content: string }> = [];
  const typeTree = isObject(overlay._?.types?.['/']) ? overlay._?.types?.['/'] : overlay._?.types;

  collectOverlayEntries(overlay['/'], typeTree, '', entries);

  for (const entry of applyOps(entries, overlay._?.ops)) {
    visit(entry.path, entry.content);
  }
}

export function applyFSOverlay(
  fs: {
    createDirectory(path: string, recursive?: boolean): { ok: true } | { ok: false; error: string };
    writeFile(path: string, content: string): { ok: true } | { ok: false; error: string };
  },
  overlay: FSOverlay | null | undefined,
): void {
  forEachOverlayFile(overlay, (absolutePath, content) => {
    writeOverlayFile(fs, absolutePath, content);
  });
}

export function createSnapshotOverlay(root: DirNode): FSOverlay {
  const tree: OverlayTree = {};
  const types: OverlayTree = {};

  const collectSnapshot = (node: FSNode): { value: unknown; types?: OverlayTree | OverlayType } => {
    if (isFile(node)) {
      if (looksBinaryString(node.content)) {
        return {
          value: encodeBinaryStringToBase64(node.content),
          types: 'base64',
        };
      }
      return { value: node.content };
    }

    const value: OverlayTree = {};
    const nestedTypes: OverlayTree = {};

    for (const child of Object.values(node.children)) {
      const snapshot = collectSnapshot(child);
      value[child.name] = snapshot.value;
      if (snapshot.types) {
        nestedTypes[child.name] = snapshot.types;
      }
    }

    return {
      value,
      types: isEmptyObject(nestedTypes) ? undefined : nestedTypes,
    };
  };

  for (const child of Object.values(root.children)) {
    const snapshot = collectSnapshot(child);
    tree[child.name] = snapshot.value;
    if (snapshot.types) {
      types[child.name] = snapshot.types;
    }
  }

  const overlay: FSOverlay = {
    '/': tree,
  };

  if (!isEmptyObject(types)) {
    overlay._ = {
      types: {
        '/': types,
      },
    };
  }

  return overlay;
}
