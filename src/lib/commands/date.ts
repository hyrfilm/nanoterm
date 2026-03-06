import { registry } from '../core/commandRegistry';

registry.register({
  name: 'date',
  description: 'Display current date and time',
  usage: 'date',
  handler: (ctx) => {
    ctx.writeStdout(new Date().toString() + '\r\n');
    return { exitCode: 0 };
  },
});
