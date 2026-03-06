import { registry } from '../core/commandRegistry';
import { isDir } from '../fs/types';

registry.register({
  name: 'cat',
  description: 'Display file contents',
  usage: 'cat <file> [file2...]',
  handler: (ctx) => {
    if (ctx.args.length === 0) {
      ctx.writeStdout('cat: missing operand\r\n');
      return { exitCode: 1 };
    }

    let exitCode = 0;
    for (const arg of ctx.args) {
      const node = ctx.fs.stat(arg);
      if (!node) {
        ctx.writeStdout(`cat: ${arg}: No such file or directory\r\n`);
        exitCode = 1;
        continue;
      }
      if (isDir(node)) {
        ctx.writeStdout(`cat: ${arg}: Is a directory\r\n`);
        exitCode = 1;
        continue;
      }
      const content = ctx.fs.readFile(arg);
      if (content !== null) {
        // Ensure content ends with newline for proper terminal display
        const output = content.replace(/\n/g, '\r\n');
        ctx.writeStdout(output);
        if (!content.endsWith('\n')) {
          ctx.writeStdout('\r\n');
        }
      }
    }
    return { exitCode };
  },
});
