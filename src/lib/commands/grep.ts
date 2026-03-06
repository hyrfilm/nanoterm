import { registry } from '../core/commandRegistry';
import { isDir, isFile, type FSNode } from '../fs/types';
import { fg, reset, bold } from '../core/ansi';

registry.register({
  name: 'grep',
  description: 'Search for patterns in files',
  usage: 'grep [-i] [-n] [-r] <pattern> <file...>',
  handler: (ctx) => {
    let caseInsensitive = false;
    let showLineNumbers = false;
    let recursive = false;
    const remaining: string[] = [];

    for (const arg of ctx.args) {
      if (arg.startsWith('-') && remaining.length === 0) {
        if (arg.includes('i')) caseInsensitive = true;
        if (arg.includes('n')) showLineNumbers = true;
        if (arg.includes('r') || arg.includes('R')) recursive = true;
      } else {
        remaining.push(arg);
      }
    }

    if (remaining.length < 1) {
      ctx.writeStdout('grep: missing pattern\r\n');
      return { exitCode: 1 };
    }

    const pattern = remaining[0];
    const targets = remaining.slice(1);
    if (targets.length === 0) {
      ctx.writeStdout('grep: missing file operand\r\n');
      return { exitCode: 1 };
    }

    const flags = caseInsensitive ? 'gi' : 'g';
    let regex: RegExp;
    try {
      regex = new RegExp(pattern, flags);
    } catch {
      ctx.writeStdout(`grep: invalid pattern '${pattern}'\r\n`);
      return { exitCode: 1 };
    }

    let found = false;
    const multiFile = targets.length > 1 || recursive;

    function searchFile(filePath: string, displayPath: string): void {
      const content = ctx.fs.readFile(filePath);
      if (content === null) return;

      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        regex.lastIndex = 0;
        if (regex.test(lines[i])) {
          found = true;
          let output = '';
          if (multiFile) output += `${fg.magenta}${displayPath}${reset}:`;
          if (showLineNumbers) output += `${fg.green}${i + 1}${reset}:`;

          // Highlight matches
          regex.lastIndex = 0;
          const highlighted = lines[i].replace(regex, (match) =>
            `${bold}${fg.red}${match}${reset}`
          );
          output += highlighted;
          ctx.writeStdout(output + '\r\n');
        }
      }
    }

    function searchRecursive(dirPath: string): void {
      const entries = ctx.fs.readDir(dirPath);
      if (!entries) return;
      for (const entry of entries) {
        const childPath = dirPath === '/' ? `/${entry.name}` : `${dirPath}/${entry.name}`;
        if (isFile(entry)) {
          searchFile(childPath, childPath);
        } else if (isDir(entry)) {
          searchRecursive(childPath);
        }
      }
    }

    for (const target of targets) {
      const resolved = ctx.fs.resolvePath(target);
      const node = ctx.fs.stat(target);
      if (!node) {
        ctx.writeStdout(`grep: ${target}: No such file or directory\r\n`);
        continue;
      }
      if (isDir(node)) {
        if (recursive) {
          searchRecursive(resolved);
        } else {
          ctx.writeStdout(`grep: ${target}: Is a directory\r\n`);
        }
      } else {
        searchFile(resolved, target);
      }
    }

    return { exitCode: found ? 0 : 1 };
  },
});
