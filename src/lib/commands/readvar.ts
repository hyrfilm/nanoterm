import { registry } from '../core/commandRegistry';

registry.register({
  name: 'readvar',
  description: 'Read a file\'s content into an environment variable',
  usage: 'readvar <VARNAME> <file>',
  handler: (ctx) => {
    const [varname, filename] = ctx.args;
    if (!varname || !filename) {
      ctx.writeStdout('usage: readvar <VARNAME> <file>\r\n');
      ctx.writeStdout('example: readvar QUOTE quote.txt\r\n');
      return { exitCode: 1 };
    }

    const content = ctx.fs.readFile(filename);
    if (content === null) {
      ctx.writeStdout(`readvar: ${filename}: no such file\r\n`);
      return { exitCode: 1 };
    }

    ctx.env.set(varname, content.trim());
    return { exitCode: 0 };
  },
});
