import { registry } from '../core/commandRegistry';

registry.register({
  name: 'clear',
  description: 'Clear the terminal screen',
  usage: 'clear',
  handler: (ctx) => {
    ctx.terminal.clear();
    return { exitCode: 0 };
  },
});
