import { registry } from '../core/commandRegistry';
import { isDir } from '../fs/types';
import { bold, fg, reset } from '../core/ansi';

registry.register({
  name: 'tree',
  description: 'Display directory tree',
  usage: 'tree [path]',
  handler: (ctx) => {
    const targetPath = ctx.args[0] || '.';
    const node = ctx.fs.stat(targetPath);

    if (!node) {
      ctx.writeStdout(`tree: '${targetPath}': No such file or directory\r\n`);
      return { exitCode: 1 };
    }

    if (!isDir(node)) {
      ctx.writeStdout(`${targetPath}\r\n`);
      return { exitCode: 0 };
    }

    let dirs = 0;
    let files = 0;

    const resolved = ctx.fs.resolvePath(targetPath);
    const displayName = targetPath === '.' ? '.' : targetPath;
    ctx.writeStdout(`${bold}${fg.blue}${displayName}${reset}\r\n`);

    function printTree(dirPath: string, prefix: string): void {
      const entries = ctx.fs.readDir(dirPath);
      if (!entries) return;
      const visible = entries.filter(e => !e.name.startsWith('.'));

      visible.forEach((entry, i) => {
        const isLast = i === visible.length - 1;
        const connector = isLast ? '└── ' : '├── ';
        const name = isDir(entry)
          ? `${bold}${fg.blue}${entry.name}${reset}`
          : entry.name;
        ctx.writeStdout(`${prefix}${connector}${name}\r\n`);

        if (isDir(entry)) {
          dirs++;
          const childPrefix = prefix + (isLast ? '    ' : '│   ');
          const childPath = dirPath === '/' ? `/${entry.name}` : `${dirPath}/${entry.name}`;
          printTree(childPath, childPrefix);
        } else {
          files++;
        }
      });
    }

    printTree(resolved, '');
    ctx.writeStdout(`\r\n${dirs} directories, ${files} files\r\n`);
    return { exitCode: 0 };
  },
});
