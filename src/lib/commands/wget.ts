import { registry } from '../core/commandRegistry';
import { dim, reset } from '../core/ansi';

registry.register({
  name: 'wget',
  description: 'Download files from the web',
  usage: 'wget <url>',
  handler: async (ctx) => {
    const url = ctx.args[0];
    if (!url) {
      ctx.writeStdout('wget: missing URL\r\n');
      return { exitCode: 1 };
    }

    try {
      const fullUrl = url.startsWith('http') ? url : `https://${url}`;
      ctx.writeStdout(`${dim}--${new Date().toISOString()}--  ${fullUrl}${reset}\r\n`);
      ctx.writeStdout(`Connecting... `);

      const response = await fetch(fullUrl);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);

      ctx.writeStdout(`connected.\r\n`);

      const text = await response.text();
      const urlObj = new URL(fullUrl);
      let filename = urlObj.pathname.split('/').filter(Boolean).pop() || 'index.html';

      const writeResult = ctx.fs.writeFile(filename, text);
      if (!writeResult.ok) {
        ctx.writeStdout(`wget: error saving file: ${writeResult.error}\r\n`);
        return { exitCode: 1 };
      }

      ctx.writeStdout(`Saving to: '${filename}'\r\n\r\n`);
      ctx.writeStdout(`'${filename}' saved [${text.length}]\r\n`);
      return { exitCode: 0 };
    } catch (e: any) {
      ctx.writeStdout(`failed.\r\n`);
      ctx.writeStdout(`wget: ${e.message}\r\n`);
      ctx.writeStdout(`${dim}(Note: CORS restrictions may block many URLs in the browser)${reset}\r\n`);
      return { exitCode: 1 };
    }
  },
});
