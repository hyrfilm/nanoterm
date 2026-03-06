import { registry } from '../core/commandRegistry';

registry.register({
  name: 'chmod',
  description: 'Change file permissions',
  usage: 'chmod <mode> <file>',
  handler: (ctx) => {
    if (ctx.args.length < 2) {
      ctx.writeStdout('chmod: missing operand\r\n');
      return { exitCode: 1 };
    }

    const mode = ctx.args[0];
    const file = ctx.args[1];
    const node = ctx.fs.stat(file);

    if (!node) {
      ctx.writeStdout(`chmod: cannot access '${file}': No such file or directory\r\n`);
      return { exitCode: 1 };
    }

    // Parse octal mode (e.g. 755, 644)
    if (/^[0-7]{3}$/.test(mode)) {
      const digits = mode.split('').map(Number);
      const parse = (d: number) => ({
        read: !!(d & 4),
        write: !!(d & 2),
        execute: !!(d & 1),
      });
      node.permissions.owner = parse(digits[0]);
      node.permissions.group = parse(digits[1]);
      node.permissions.other = parse(digits[2]);
      return { exitCode: 0 };
    }

    // Parse symbolic mode (e.g. +x, -w, u+x)
    const symMatch = mode.match(/^([ugoa]*)([+-=])([rwx]+)$/);
    if (symMatch) {
      const who = symMatch[1] || 'a';
      const op = symMatch[2];
      const perms = symMatch[3];
      const targets: ('owner' | 'group' | 'other')[] = [];
      if (who.includes('u') || who.includes('a')) targets.push('owner');
      if (who.includes('g') || who.includes('a')) targets.push('group');
      if (who.includes('o') || who.includes('a')) targets.push('other');

      for (const target of targets) {
        for (const p of perms) {
          const key = p === 'r' ? 'read' : p === 'w' ? 'write' : 'execute';
          if (op === '+') node.permissions[target][key] = true;
          else if (op === '-') node.permissions[target][key] = false;
          else { // =
            node.permissions[target].read = perms.includes('r');
            node.permissions[target].write = perms.includes('w');
            node.permissions[target].execute = perms.includes('x');
          }
        }
      }
      return { exitCode: 0 };
    }

    ctx.writeStdout(`chmod: invalid mode: '${mode}'\r\n`);
    return { exitCode: 1 };
  },
});
