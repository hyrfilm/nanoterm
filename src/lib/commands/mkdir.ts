import { registry } from '../core/commandRegistry';

registry.register({
  name: 'mkdir',
  description: 'Create directories',
  usage: 'mkdir [-p] <directory...>',
  handler: (ctx) => {
    let recursive = false;
    const dirs: string[] = [];

    for (const arg of ctx.args) {
      if (arg === '-p') { recursive = true; continue; }
      dirs.push(arg);
    }

    if (dirs.length === 0) {
      ctx.writeStdout('mkdir: missing operand\r\n');
      return { exitCode: 1 };
    }

    let exitCode = 0;
    for (const dir of dirs) {
      const result = ctx.fs.createDirectory(dir, recursive);
      if (!result.ok) {
        ctx.writeStdout(result.error + '\r\n');
        exitCode = 1;
      }
    }
    return { exitCode };
  },
});
