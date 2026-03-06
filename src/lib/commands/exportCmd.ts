import { registry } from '../core/commandRegistry';

registry.register({
  name: 'export',
  description: 'Set environment variables',
  usage: 'export [NAME=value]',
  handler: (ctx) => {
    if (ctx.args.length === 0) {
      // Show all exports
      for (const [key, value] of ctx.env) {
        ctx.writeStdout(`declare -x ${key}="${value}"\r\n`);
      }
      return { exitCode: 0 };
    }

    for (const arg of ctx.args) {
      const eqIdx = arg.indexOf('=');
      if (eqIdx === -1) {
        // Just mark as exported (noop in our case)
        continue;
      }
      const name = arg.substring(0, eqIdx);
      const value = arg.substring(eqIdx + 1);
      ctx.env.set(name, value);
    }
    return { exitCode: 0 };
  },
});
