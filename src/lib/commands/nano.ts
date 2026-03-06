import { registry } from '../core/commandRegistry';
import { NanoEditor } from '../editor/nanoEditor';

registry.register({
  name: 'nano',
  description: 'Simple text editor',
  usage: 'nano [filename]',
  handler: async (ctx) => {
    const filename = ctx.args[0] || '';

    // Access the shell to set activeEditor - we pass the shell via a side channel
    const shell = (ctx as any).__shell__;
    const editor = new NanoEditor(ctx.terminal, ctx.fs, filename);

    if (shell) {
      shell.activeEditor = editor;
    }

    const result = await editor.run();

    if (shell) {
      shell.activeEditor = null;
    }

    return result;
  },
});
