import { registry } from '../core/commandRegistry';

registry.register({
  name: 'cd',
  description: 'Change directory',
  usage: 'cd [directory]',
  handler: (ctx) => {
    const target = ctx.args[0] || '~';

    if (target === '-') {
      const oldPwd = ctx.env.get('OLDPWD');
      if (!oldPwd) {
        ctx.writeStdout('cd: OLDPWD not set\r\n');
        return { exitCode: 1 };
      }
      const currentPwd = ctx.fs.cwd;
      const result = ctx.fs.cd(oldPwd);
      if (!result.ok) {
        ctx.writeStdout(result.error + '\r\n');
        return { exitCode: 1 };
      }
      ctx.env.set('OLDPWD', currentPwd);
      ctx.writeStdout(ctx.fs.cwd + '\r\n');
      return { exitCode: 0 };
    }

    const currentPwd = ctx.fs.cwd;
    const result = ctx.fs.cd(target);
    if (!result.ok) {
      ctx.writeStdout(result.error + '\r\n');
      return { exitCode: 1 };
    }
    ctx.env.set('OLDPWD', currentPwd);
    return { exitCode: 0 };
  },
});
