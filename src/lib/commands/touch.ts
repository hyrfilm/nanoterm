import { registry } from '../core/commandRegistry';

registry.register({
  name: 'touch',
  description: 'Create empty file or update timestamp',
  usage: 'touch <file...>',
  handler: (ctx) => {
    if (ctx.args.length === 0) {
      ctx.writeStdout('touch: missing operand\r\n');
      return { exitCode: 1 };
    }

    let exitCode = 0;
    for (const arg of ctx.args) {
      const result = ctx.fs.touch(arg);
      if (!result.ok) {
        ctx.writeStdout(result.error + '\r\n');
        exitCode = 1;
      }
    }
    return { exitCode };
  },
});
