import { registry } from '../core/commandRegistry';

registry.register({
  name: 'whoami',
  description: 'Print current user name',
  usage: 'whoami',
  handler: (ctx) => {
    ctx.writeStdout((ctx.env.get('USER') || 'guest') + '\r\n');
    return { exitCode: 0 };
  },
});
