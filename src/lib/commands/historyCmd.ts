import { registry } from '../core/commandRegistry';

registry.register({
  name: 'history',
  description: 'Show command history',
  usage: 'history',
  handler: (ctx) => {
    const entries = ctx.history;
    entries.forEach((entry, i) => {
      ctx.writeStdout(`  ${String(i + 1).padStart(4)}  ${entry}\r\n`);
    });
    return { exitCode: 0 };
  },
});
