import { registry } from '../core/commandRegistry';

registry.register({
  name: 'echo',
  description: 'Display text',
  usage: 'echo [-e] [-n] [text...]',
  handler: (ctx) => {
    let interpretEscapes = false;
    let noNewline = false;
    const textParts: string[] = [];

    for (const arg of ctx.args) {
      if (arg === '-e' && textParts.length === 0) { interpretEscapes = true; continue; }
      if (arg === '-n' && textParts.length === 0) { noNewline = true; continue; }
      if (arg === '-en' || arg === '-ne') { interpretEscapes = true; noNewline = true; continue; }
      textParts.push(arg);
    }

    let output = textParts.join(' ');

    if (interpretEscapes) {
      output = output
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\r/g, '\r')
        .replace(/\\\\/g, '\\')
        .replace(/\\e/g, '\x1b')
        .replace(/\\033/g, '\x1b');
    }

    const formatted = output.replace(/\n/g, '\r\n');
    ctx.writeStdout(formatted);
    if (!noNewline) ctx.writeStdout('\r\n');

    return { exitCode: 0 };
  },
});
