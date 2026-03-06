import { registry } from '../core/commandRegistry';

registry.register({
  name: 'mv',
  description: 'Move or rename files',
  usage: 'mv <source> <destination>',
  handler: (ctx) => {
    if (ctx.args.length < 2) {
      ctx.writeStdout('mv: missing operand\r\n');
      return { exitCode: 1 };
    }
    const result = ctx.fs.move(ctx.args[0], ctx.args[1]);
    if (!result.ok) {
      ctx.writeStdout(result.error + '\r\n');
      return { exitCode: 1 };
    }
    return { exitCode: 0 };
  },
});
