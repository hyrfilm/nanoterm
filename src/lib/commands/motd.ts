import { registry } from '../core/commandRegistry';
import { bold, dim, fg, reset } from '../core/ansi';

const fallbackMotd = `${bold}${fg.cyan}
  _   _                   _
 | \\ | | __ _ _ __   ___ | |_ ___ _ __ _ __ ___
 |  \\| |/ _\` | '_ \\ / _ \\| __/ _ \\ '__| '\_ \` _ \\
 | |\\  | (_| | | | | (_) | ||  __/ |  | | | | | |
 |_| \\_|\\__,_|_| |_|\\___/ \\__\\___|_|  |_| |_| |_|
${reset}
 ${dim}A browser-based terminal emulator${reset}
 ${dim}Type '${reset}help${dim}' for available commands.${reset}
`;

function toTerminalOutput(value: string): string {
  const normalized = value.replace(/\r?\n/g, '\r\n');
  return normalized.endsWith('\r\n') ? normalized : `${normalized}\r\n`;
}

registry.register({
  name: 'motd',
  description: 'Print message of the day',
  usage: 'motd',
  handler: (ctx) => {
    const fileMotd = ctx.fs.readFile('/etc/motd');
    const selected = fileMotd && fileMotd.trim().length > 0 ? fileMotd : fallbackMotd;
    ctx.writeStdout(toTerminalOutput(selected));
    return { exitCode: 0 };
  },
});
