import { registry } from '../core/commandRegistry';

registry.register({
  name: 'infomsg',
  description: 'Print the configured startup info message',
  usage: 'infomsg',
  handler: (ctx) => {
    const message = ctx.env.get('NANOTERM_INFO_MSG');
    if (!message) {
      return { exitCode: 0 };
    }

    const normalized = message.replace(/\r?\n/g, '\r\n');
    ctx.writeStdout(normalized.endsWith('\r\n') ? normalized : `${normalized}\r\n`);
    return { exitCode: 0 };
  },
});
