import { registry } from '../core/commandRegistry';

registry.register({
  name: 'cp',
  description: 'Copy files or directories',
  usage: 'cp [-r] <source> <destination>',
  handler: (ctx) => {
    let recursive = false;
    const paths: string[] = [];

    for (const arg of ctx.args) {
      if (arg === '-r' || arg === '-R') { recursive = true; continue; }
      paths.push(arg);
    }

    if (paths.length < 2) {
      ctx.writeStdout('cp: missing operand\r\n');
      return { exitCode: 1 };
    }

    const result = ctx.fs.copy(paths[0], paths[1], recursive);
    if (!result.ok) {
      ctx.writeStdout(result.error + '\r\n');
      return { exitCode: 1 };
    }
    return { exitCode: 0 };
  },
});
