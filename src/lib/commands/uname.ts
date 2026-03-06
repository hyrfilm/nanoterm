import { registry } from '../core/commandRegistry';

registry.register({
  name: 'uname',
  description: 'Print system information',
  usage: 'uname [-a]',
  handler: (ctx) => {
    if (ctx.args.includes('-a')) {
      ctx.writeStdout('NanoTerm 1.0.0 nanoterm Browser/WASM nanoterm NanoTerm\r\n');
    } else {
      ctx.writeStdout('NanoTerm\r\n');
    }
    return { exitCode: 0 };
  },
});
