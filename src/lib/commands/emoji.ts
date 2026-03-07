import { registry } from '../core/commandRegistry';

registry.register({
  name: 'emoji',
  description: 'Translate text to emojis (via tcpdata.com)',
  usage: 'emoji [-f file] [text...]',
  handler: async (ctx) => {
    const args = [...ctx.args];
    let text = '';

    if (args[0] === '-f' && args[1]) {
      const content = ctx.fs.readFile(args[1]);
      if (content === null) {
        ctx.writeStdout(`emoji: ${args[1]}: no such file\r\n`);
        return { exitCode: 1 };
      }
      text = content.trim().split('\n')[0];
    } else {
      text = args.join(' ');
    }

    if (!text) {
      ctx.writeStdout('usage: emoji [-f file] [text]\r\n');
      return { exitCode: 1 };
    }

    try {
      const url = `https://tcpdata.com/emoji/${encodeURIComponent(text)}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json() as { translated: string };
      ctx.writeStdout(data.translated + '\r\n');
      return { exitCode: 0 };
    } catch (e: any) {
      ctx.writeStdout(`emoji: ${e.message}\r\n`);
      return { exitCode: 1 };
    }
  },
});
