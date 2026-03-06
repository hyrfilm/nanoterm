import { registry } from '../core/commandRegistry';

registry.register({
  name: 'pwd',
  description: 'Print working directory',
  usage: 'pwd',
  handler: (ctx) => {
    ctx.writeStdout(ctx.fs.cwd + '\r\n');
    return { exitCode: 0 };
  },
});
