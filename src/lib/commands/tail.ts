import { registry } from '../core/commandRegistry';

registry.register({
  name: 'tail',
  description: 'Display last lines of a file',
  usage: 'tail [-n count] <file>',
  handler: (ctx) => {
    let count = 10;
    let file = '';

    for (let i = 0; i < ctx.args.length; i++) {
      if (ctx.args[i] === '-n' && i + 1 < ctx.args.length) {
        count = parseInt(ctx.args[++i], 10);
        if (isNaN(count)) { ctx.writeStdout('tail: invalid number of lines\r\n'); return { exitCode: 1 }; }
      } else {
        file = ctx.args[i];
      }
    }

    if (!file) {
      ctx.writeStdout('tail: missing operand\r\n');
      return { exitCode: 1 };
    }

    const content = ctx.fs.readFile(file);
    if (content === null) {
      ctx.writeStdout(`tail: ${file}: No such file or directory\r\n`);
      return { exitCode: 1 };
    }

    const allLines = content.split('\n');
    const lines = allLines.slice(-count);
    ctx.writeStdout(lines.join('\r\n') + '\r\n');
    return { exitCode: 0 };
  },
});
