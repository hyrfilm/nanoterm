export type NodeType = 'file' | 'directory';

export interface FSPermissions {
  owner: { read: boolean; write: boolean; execute: boolean };
  group: { read: boolean; write: boolean; execute: boolean };
  other: { read: boolean; write: boolean; execute: boolean };
}

export interface FSNodeBase {
  name: string;
  type: NodeType;
  permissions: FSPermissions;
  owner: string;
  group: string;
  createdAt: Date;
  modifiedAt: Date;
}

export interface FileNode extends FSNodeBase {
  type: 'file';
  content: string;
}

export interface DirNode extends FSNodeBase {
  type: 'directory';
  children: Map<string, FSNode>;
}

export type FSNode = FileNode | DirNode;

export function isFile(node: FSNode): node is FileNode {
  return node.type === 'file';
}

export function isDir(node: FSNode): node is DirNode {
  return node.type === 'directory';
}

export function defaultFilePerms(): FSPermissions {
  return {
    owner: { read: true, write: true, execute: false },
    group: { read: true, write: false, execute: false },
    other: { read: true, write: false, execute: false },
  };
}

export function defaultDirPerms(): FSPermissions {
  return {
    owner: { read: true, write: true, execute: true },
    group: { read: true, write: false, execute: true },
    other: { read: true, write: false, execute: true },
  };
}

export function permissionsToString(p: FSPermissions): string {
  const fmt = (perm: { read: boolean; write: boolean; execute: boolean }) =>
    (perm.read ? 'r' : '-') + (perm.write ? 'w' : '-') + (perm.execute ? 'x' : '-');
  return fmt(p.owner) + fmt(p.group) + fmt(p.other);
}

export function makeFile(name: string, content: string, owner = 'guest', group = 'guest'): FileNode {
  const now = new Date();
  return { name, type: 'file', content, permissions: defaultFilePerms(), owner, group, createdAt: now, modifiedAt: now };
}

export function makeDir(name: string, children: Map<string, FSNode> = new Map(), owner = 'guest', group = 'guest'): DirNode {
  const now = new Date();
  return { name, type: 'directory', children, permissions: defaultDirPerms(), owner, group, createdAt: now, modifiedAt: now };
}
