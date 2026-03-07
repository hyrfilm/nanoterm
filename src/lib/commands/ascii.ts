import { registry } from '../core/commandRegistry';

const MAX_TEXT = 20;

registry.register({
  name: 'ascii',
  description: 'Convert text to ASCII art (via tcpdata.com)',
  usage: 'ascii [-s box|blocks|stars|hash|banner] [-f file] [text...]',
  handler: async (ctx) => {
    const args = [...ctx.args];
    let style = 'box';
    let text = '';

    for (let i = 0; i < args.length; i++) {
      if (args[i] === '-s' && args[i + 1]) {
        style = args[++i];
      } else if (args[i] === '-f' && args[i + 1]) {
        const content = ctx.fs.readFile(args[++i]);
        if (content === null) {
          ctx.writeStdout(`ascii: ${args[i]}: no such file\r\n`);
          return { exitCode: 1 };
        }
        text = content.trim().split('\n')[0].slice(0, MAX_TEXT);
      } else {
        text = args.slice(i).join(' ');
        break;
      }
    }

    if (!text) {
      ctx.writeStdout('usage: ascii [-s box|blocks|stars|hash|banner] [-f file] [text]\r\n');
      return { exitCode: 1 };
    }

    text = text.slice(0, MAX_TEXT);

    try {
      const url = `https://tcpdata.com/ascii/${encodeURIComponent(text)}?style=${style}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json() as { ascii: string };
      ctx.writeStdout(data.ascii.replace(/\n/g, '\r\n') + '\r\n');
      return { exitCode: 0 };
    } catch (e: any) {
      ctx.writeStdout(`ascii: ${e.message}\r\n`);
      return { exitCode: 1 };
    }
  },
});
