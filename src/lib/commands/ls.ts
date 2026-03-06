import { registry } from '../core/commandRegistry';
import { isDir, isFile, permissionsToString } from '../fs/types';
import { bold, fg, reset } from '../core/ansi';

registry.register({
  name: 'ls',
  description: 'List directory contents',
  usage: 'ls [-l] [-a] [path]',
  handler: (ctx) => {
    let longFormat = false;
    let showHidden = false;
    const paths: string[] = [];

    for (const arg of ctx.args) {
      if (arg.startsWith('-') && !arg.startsWith('--')) {
        if (arg.includes('l')) longFormat = true;
        if (arg.includes('a')) showHidden = true;
      } else {
        paths.push(arg);
      }
    }

    const targetPath = paths[0] || '.';
    const node = ctx.fs.stat(targetPath);

    if (!node) {
      ctx.writeStdout(`ls: cannot access '${targetPath}': No such file or directory\r\n`);
      return { exitCode: 1 };
    }

    if (isFile(node)) {
      if (longFormat) {
        const perms = permissionsToString(node.permissions);
        const date = formatDate(node.modifiedAt);
        ctx.writeStdout(`-${perms} ${node.owner.padEnd(6)} ${node.group.padEnd(6)} ${String(node.content.length).padStart(6)} ${date} ${node.name}\r\n`);
      } else {
        ctx.writeStdout(`${node.name}\r\n`);
      }
      return { exitCode: 0 };
    }

    const entries = ctx.fs.readDir(targetPath);
    if (!entries) {
      ctx.writeStdout(`ls: cannot access '${targetPath}': No such file or directory\r\n`);
      return { exitCode: 1 };
    }

    const filtered = showHidden ? entries : entries.filter(e => !e.name.startsWith('.'));

    if (longFormat) {
      ctx.writeStdout(`total ${filtered.length}\r\n`);
      for (const entry of filtered) {
        const typeChar = isDir(entry) ? 'd' : '-';
        const perms = permissionsToString(entry.permissions);
        const size = isFile(entry) ? entry.content.length : 4096;
        const date = formatDate(entry.modifiedAt);
        const name = isDir(entry)
          ? `${bold}${fg.blue}${entry.name}${reset}`
          : entry.name;
        ctx.writeStdout(`${typeChar}${perms} ${entry.owner.padEnd(6)} ${entry.group.padEnd(6)} ${String(size).padStart(6)} ${date} ${name}\r\n`);
      }
    } else {
      const names = filtered.map(e =>
        isDir(e) ? `${bold}${fg.blue}${e.name}${reset}` : e.name
      );
      if (names.length > 0) {
        ctx.writeStdout(names.join('  ') + '\r\n');
      }
    }

    return { exitCode: 0 };
  },
});

function formatDate(d: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const day = String(d.getDate()).padStart(2, ' ');
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${month} ${day} ${hours}:${mins}`;
}
