import { registry } from '../core/commandRegistry';

registry.register({
  name: 'curl',
  description: 'Fetch a URL and write the response body to stdout',
  usage: 'curl <url>',
  handler: async (ctx) => {
    const url = ctx.args[0];
    if (!url) {
      ctx.writeStdout('curl: missing URL\r\n');
      return { exitCode: 1 };
    }

    const fullUrl = url.startsWith('http') ? url : `https://${url}`;

    try {
      const resp = await fetch(fullUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      ctx.writeStdout(text);
      return { exitCode: 0 };
    } catch (e: any) {
      ctx.writeStdout(`curl: ${e.message}\r\n`);
      return { exitCode: 1 };
    }
  },
});
