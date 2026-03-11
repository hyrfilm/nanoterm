import { type FSNode, type FileNode, type DirNode, isFile, isDir, makeFile, makeDir } from './types';

export class VirtualFS {
  root: DirNode;
  private _cwd: string;
  readonly username: string;

  constructor(root: DirNode, username = 'guest') {
    this.root = root;
    this.username = username;
    this._cwd = `/home/${username}`;
  }

  get cwd(): string {
    return this._cwd;
  }

  get home(): string {
    return `/home/${this.username}`;
  }

  resolvePath(inputPath: string): string {
    let path = inputPath;
    if (path === '~' || path.startsWith('~/')) {
      path = this.home + path.slice(1);
    }
    if (!path.startsWith('/')) {
      path = this._cwd + '/' + path;
    }
    const parts = path.split('/').filter(Boolean);
    const resolved: string[] = [];
    for (const part of parts) {
      if (part === '.') continue;
      if (part === '..') { resolved.pop(); continue; }
      resolved.push(part);
    }
    return '/' + resolved.join('/');
  }

  private getNode(absolutePath: string): FSNode | null {
    if (absolutePath === '/') return this.root;
    const parts = absolutePath.split('/').filter(Boolean);
    let current: FSNode = this.root;
    for (const part of parts) {
      if (!isDir(current)) return null;
      // @ts-ignore
        const child = current.children[part];
      if (!child) return null;
      current = child;
    }
    return current;
  }

  private getParentAndName(absolutePath: string): { parent: DirNode; name: string } | null {
    if (absolutePath === '/') return null;
    const parts = absolutePath.split('/').filter(Boolean);
    const name = parts.pop()!;
    const parentPath = '/' + parts.join('/');
    const parent = this.getNode(parentPath);
    if (!parent || !isDir(parent)) return null;
    return { parent, name };
  }

  stat(path: string): FSNode | null {
    return this.getNode(this.resolvePath(path));
  }

  exists(path: string): boolean {
    return this.stat(path) !== null;
  }

  cd(path: string): { ok: true } | { ok: false; error: string } {
    const target = path || '~';
    const resolved = this.resolvePath(target);
    const node = this.getNode(resolved);
    if (!node) return { ok: false, error: `cd: ${path}: No such file or directory` };
    if (!isDir(node)) return { ok: false, error: `cd: ${path}: Not a directory` };
    this._cwd = resolved;
    return { ok: true };
  }

  readFile(path: string): string | null {
    const resolved = this.resolvePath(path);
    const node = this.getNode(resolved);
    if (!node || !isFile(node)) return null;
    return node.content;
  }

  readDir(path: string): FSNode[] | null {
    const resolved = this.resolvePath(path);
    const node = this.getNode(resolved);
    if (!node || !isDir(node)) return null;
    return Object.values(node.children).sort((a, b) => a.name.localeCompare(b.name));
  }

  writeFile(path: string, content: string): { ok: true } | { ok: false; error: string } {
    const resolved = this.resolvePath(path);
    const info = this.getParentAndName(resolved);
    if (!info) return { ok: false, error: `Cannot write to ${path}` };
    const { parent, name } = info;
    const existing = parent.children[name];
    if (existing && isDir(existing)) return { ok: false, error: `${path}: Is a directory` };
    if (existing && isFile(existing)) {
      existing.content = content;
      existing.modifiedAt = new Date();
    } else {
      parent.children[name] = makeFile(name, content, this.username);
    }
    return { ok: true };
  }

  createDirectory(path: string, recursive = false): { ok: true } | { ok: false; error: string } {
    const resolved = this.resolvePath(path);
    if (recursive) {
      const parts = resolved.split('/').filter(Boolean);
      let current = this.root;
      for (const part of parts) {
        let child = current.children[part];
        if (!child) {
          child = makeDir(part, {}, this.username);
          current.children[part] = child;
        } else if (!isDir(child)) {
          return { ok: false, error: `${path}: Not a directory` };
        }
        current = child as DirNode;
      }
      return { ok: true };
    }
    const info = this.getParentAndName(resolved);
    if (!info) return { ok: false, error: `mkdir: cannot create directory '${path}': No such file or directory` };
    const { parent, name } = info;
    if (name in parent.children) return { ok: false, error: `mkdir: cannot create directory '${path}': File exists` };
    parent.children[name] = makeDir(name, {}, this.username);
    return { ok: true };
  }

  remove(path: string, recursive = false): { ok: true } | { ok: false; error: string } {
    const resolved = this.resolvePath(path);
    if (resolved === '/') return { ok: false, error: 'rm: cannot remove root directory' };
    const info = this.getParentAndName(resolved);
    if (!info) return { ok: false, error: `rm: cannot remove '${path}': No such file or directory` };
    const { parent, name } = info;
    const node = parent.children[name];
    if (!node) return { ok: false, error: `rm: cannot remove '${path}': No such file or directory` };
    if (isDir(node) && !recursive) return { ok: false, error: `rm: cannot remove '${path}': Is a directory` };
    delete parent.children[name];
    return { ok: true };
  }

  move(src: string, dest: string): { ok: true } | { ok: false; error: string } {
    const srcResolved = this.resolvePath(src);
    const srcInfo = this.getParentAndName(srcResolved);
    if (!srcInfo) return { ok: false, error: `mv: cannot stat '${src}': No such file or directory` };
    const srcNode = srcInfo.parent.children[srcInfo.name];
    if (!srcNode) return { ok: false, error: `mv: cannot stat '${src}': No such file or directory` };

    let destResolved = this.resolvePath(dest);
    const destNode = this.getNode(destResolved);
    if (destNode && isDir(destNode)) {
      destResolved = destResolved + '/' + srcInfo.name;
    }

    const destInfo = this.getParentAndName(destResolved);
    if (!destInfo) return { ok: false, error: `mv: cannot move to '${dest}': No such file or directory` };

    delete srcInfo.parent.children[srcInfo.name];
    srcNode.name = destInfo.name;
    destInfo.parent.children[destInfo.name] = srcNode;
    return { ok: true };
  }

  copy(src: string, dest: string, recursive = false): { ok: true } | { ok: false; error: string } {
    const srcResolved = this.resolvePath(src);
    const srcNode = this.getNode(srcResolved);
    if (!srcNode) return { ok: false, error: `cp: cannot stat '${src}': No such file or directory` };
    if (isDir(srcNode) && !recursive) return { ok: false, error: `cp: -r not specified; omitting directory '${src}'` };

    let destResolved = this.resolvePath(dest);
    const destNode = this.getNode(destResolved);
    if (destNode && isDir(destNode)) {
      destResolved = destResolved + '/' + srcNode.name;
    }

    const clone = this.deepClone(srcNode);
    const destInfo = this.getParentAndName(destResolved);
    if (!destInfo) return { ok: false, error: `cp: cannot create '${dest}': No such file or directory` };
    clone.name = destInfo.name;
    destInfo.parent.children[destInfo.name] = clone;
    return { ok: true };
  }

  private deepClone(node: FSNode): FSNode {
    if (isFile(node)) {
      return { ...node, createdAt: new Date(node.createdAt), modifiedAt: new Date(node.modifiedAt) };
    }
    const children: Record<string, FSNode> = {};
    for (const [name, child] of Object.entries((node as DirNode).children)) {
      children[name] = this.deepClone(child);
    }
    return { ...node, children, createdAt: new Date(node.createdAt), modifiedAt: new Date(node.modifiedAt) } as DirNode;
  }

  touch(path: string): { ok: true } | { ok: false; error: string } {
    const resolved = this.resolvePath(path);
    const node = this.getNode(resolved);
    if (node) {
      node.modifiedAt = new Date();
      return { ok: true };
    }
    return this.writeFile(path, '');
  }

  getCompletions(partial: string): string[] {
    let dirPath: string;
    let prefix: string;

    if (partial.includes('/')) {
      const lastSlash = partial.lastIndexOf('/');
      dirPath = partial.substring(0, lastSlash) || '/';
      prefix = partial.substring(lastSlash + 1);
    } else {
      dirPath = '.';
      prefix = partial;
    }

    const resolved = this.resolvePath(dirPath);
    const node = this.getNode(resolved);
    if (!node || !isDir(node)) return [];

    const results: string[] = [];
    for (const [name, child] of Object.entries(node.children)) {
      if (name.startsWith(prefix)) {
        const base = partial.includes('/') ? partial.substring(0, partial.lastIndexOf('/') + 1) : '';
        results.push(base + name + (isDir(child) ? '/' : ''));
      }
    }
    return results.sort();
  }

  walk(path: string, callback: (path: string, node: FSNode, depth: number) => void): void {
    const resolved = this.resolvePath(path);
    const node = this.getNode(resolved);
    if (!node) return;
    this.walkNode(resolved, node, 0, callback);
  }

  private walkNode(currentPath: string, node: FSNode, depth: number, callback: (path: string, node: FSNode, depth: number) => void): void {
    callback(currentPath, node, depth);
    if (isDir(node)) {
      const sorted = Object.values(node.children).sort((a, b) => a.name.localeCompare(b.name));
      for (const child of sorted) {
        const childPath = currentPath === '/' ? `/${child.name}` : `${currentPath}/${child.name}`;
        this.walkNode(childPath, child, depth + 1, callback);
      }
    }
  }
}
