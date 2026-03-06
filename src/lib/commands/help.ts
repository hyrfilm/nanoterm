import { registry } from '../core/commandRegistry';
import { bold, reset, fg, dim } from '../core/ansi';

registry.register({
  name: 'help',
  description: 'Show available commands',
  usage: 'help [command]',
  handler: (ctx) => {
    if (ctx.args.length > 0) {
      const cmd = registry.get(ctx.args[0]);
      if (!cmd) {
        ctx.writeStdout(`help: no help for '${ctx.args[0]}'\r\n`);
        return { exitCode: 1 };
      }
      ctx.writeStdout(`${bold}${cmd.name}${reset} - ${cmd.description}\r\n`);
      ctx.writeStdout(`${dim}Usage:${reset} ${cmd.usage}\r\n`);
      return { exitCode: 0 };
    }

    ctx.writeStdout(`\r\n${bold}Available commands:${reset}\r\n\r\n`);
    const all = registry.getAll();
    const maxLen = Math.max(...all.map(c => c.name.length));
    for (const cmd of all) {
      ctx.writeStdout(`  ${fg.green}${cmd.name.padEnd(maxLen + 2)}${reset}${cmd.description}\r\n`);
    }
    ctx.writeStdout(`\r\nType ${fg.cyan}help <command>${reset} for more info on a specific command.\r\n\r\n`);
    return { exitCode: 0 };
  },
});
