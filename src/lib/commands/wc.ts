import { registry } from '../core/commandRegistry';

registry.register({
  name: 'wc',
  description: 'Count lines, words, and characters',
  usage: 'wc <file...>',
  handler: (ctx) => {
    if (ctx.args.length === 0) {
      ctx.writeStdout('wc: missing operand\r\n');
      return { exitCode: 1 };
    }

    let totalLines = 0, totalWords = 0, totalChars = 0;
    let exitCode = 0;

    for (const file of ctx.args) {
      const content = ctx.fs.readFile(file);
      if (content === null) {
        ctx.writeStdout(`wc: ${file}: No such file or directory\r\n`);
        exitCode = 1;
        continue;
      }
      const lines = content.split('\n').length - (content.endsWith('\n') ? 1 : 0);
      const words = content.split(/\s+/).filter(w => w.length > 0).length;
      const chars = content.length;
      totalLines += lines;
      totalWords += words;
      totalChars += chars;
      ctx.writeStdout(`  ${String(lines).padStart(6)} ${String(words).padStart(6)} ${String(chars).padStart(6)} ${file}\r\n`);
    }

    if (ctx.args.length > 1) {
      ctx.writeStdout(`  ${String(totalLines).padStart(6)} ${String(totalWords).padStart(6)} ${String(totalChars).padStart(6)} total\r\n`);
    }

    return { exitCode };
  },
});
