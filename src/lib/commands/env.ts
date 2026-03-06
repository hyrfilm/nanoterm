import { registry } from '../core/commandRegistry';

registry.register({
  name: 'env',
  description: 'Print environment variables',
  usage: 'env',
  handler: (ctx) => {
    for (const [key, value] of ctx.env) {
      ctx.writeStdout(`${key}=${value}\r\n`);
    }
    return { exitCode: 0 };
  },
});
