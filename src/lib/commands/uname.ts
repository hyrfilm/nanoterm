import { registry } from '../core/commandRegistry';

registry.register({
  name: 'uname',
  description: 'Print system information',
  usage: 'uname [-a]',
  handler: (ctx) => {
    if (ctx.args.includes('-a')) {
      ctx.writeStdout('nanoterm 1.0.0 browser xterm\r\n');
    } else {
      ctx.writeStdout('nanoterm\r\n');
    }
    return { exitCode: 0 };
  },
});
