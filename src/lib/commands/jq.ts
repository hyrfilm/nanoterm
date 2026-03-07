import { registry } from '../core/commandRegistry';

function getPath(obj: unknown, path: string): unknown {
  const parts = path.replace(/^\./, '').split('.').filter(Boolean);
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

registry.register({
  name: 'jq',
  description: 'Extract fields from a JSON file using dot-path syntax',
  usage: 'jq [-r] <.path> <file>',
  handler: (ctx) => {
    const args = [...ctx.args];
    let raw = false;
    if (args[0] === '-r') { raw = true; args.shift(); }

    const [path, filename] = args;
    if (!path || !filename) {
      ctx.writeStdout('usage: jq [-r] <.path> <file>\r\n');
      ctx.writeStdout('example: jq -r .content data.json\r\n');
      return { exitCode: 1 };
    }

    const content = ctx.fs.readFile(filename);
    if (content === null) {
      ctx.writeStdout(`jq: ${filename}: no such file\r\n`);
      return { exitCode: 1 };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      ctx.writeStdout('jq: invalid JSON\r\n');
      return { exitCode: 1 };
    }

    const value = getPath(parsed, path);
    if (value === undefined) {
      ctx.writeStdout('null\r\n');
      return { exitCode: 0 };
    }

    const out = raw && typeof value === 'string'
      ? value
      : JSON.stringify(value, null, 2);
    ctx.writeStdout(out.replace(/\n/g, '\r\n') + '\r\n');
    return { exitCode: 0 };
  },
});
