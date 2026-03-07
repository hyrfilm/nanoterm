import { registry } from '../core/commandRegistry';
import { isRecording, startRecording, stopRecording, encodeRecording, MAX_COMMANDS } from './recorder';

registry.register({
  name: 'record',
  description: 'Record terminal commands. Run again to stop.',
  usage: 'record',
  handler: (ctx) => {
    if (isRecording()) {
      const r = stopRecording();
      if (!r || r.commands.length === 0) {
        ctx.writeStdout('record: stopped. No commands recorded.\r\n');
        return { exitCode: 0 };
      }
      const encoded = encodeRecording(r);
      ctx.writeStdout(`record: stopped. ${r.commands.length} command(s) recorded.\r\n\r\n`);
      ctx.writeStdout(`${JSON.stringify(r)}\r\n\r\n`);
      ctx.writeStdout(`replay ${encoded}\r\n\r\n`);
      ctx.writeStdout(`https://hyrfilm.github.io/nanoterm?replay=${encoded}\r\n`);
    } else {
      startRecording();
      ctx.writeStdout(`record: started. Run 'record' again to stop (max ${MAX_COMMANDS} commands).\r\n`);
    }
    return { exitCode: 0 };
  },
});
