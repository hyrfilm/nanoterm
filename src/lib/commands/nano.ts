import { registry } from '../core/commandRegistry';
import { NanoEditor } from '../editor/nanoEditor';

registry.register({
  name: 'nano',
  description: 'Simple text editor',
  usage: 'nano [filename]',
  handler: async (ctx) => {
    const filename = ctx.args[0] || '';
    const editor = new NanoEditor(ctx.terminal, ctx.fs, filename);

    if (ctx.shell) {
      ctx.shell.activeEditor = editor;
    }

    const result = await editor.run();

    if (ctx.shell) {
      ctx.shell.activeEditor = null;
    }

    return result;
  },
});
