import { registry } from '../core/commandRegistry';

registry.register({
  name: 'rm',
  description: 'Remove files or directories',
  usage: 'rm [-r] [-f] <file...>',
  handler: (ctx) => {
    let recursive = false;
    let force = false;
    const targets: string[] = [];

    for (const arg of ctx.args) {
      if (arg.startsWith('-') && !arg.startsWith('--')) {
        if (arg.includes('r') || arg.includes('R')) recursive = true;
        if (arg.includes('f')) force = true;
      } else {
        targets.push(arg);
      }
    }

    if (targets.length === 0) {
      ctx.writeStdout('rm: missing operand\r\n');
      return { exitCode: 1 };
    }

    let exitCode = 0;
    for (const target of targets) {
      const result = ctx.fs.remove(target, recursive);
      if (!result.ok && !force) {
        ctx.writeStdout(result.error + '\r\n');
        exitCode = 1;
      }
    }
    return { exitCode };
  },
});
