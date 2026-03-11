import { registry } from '../core/commandRegistry';
import { createSnapshotOverlay, encodeOverlayForUrl } from '../fs/overlay';

registry.register({
  name: 'snapshot',
  description: 'Export the current filesystem as an overlay link',
  usage: 'snapshot',
  handler: (ctx) => {
    const overlay = createSnapshotOverlay(ctx.fs.root);
    const encoded = encodeOverlayForUrl(overlay);

    const baseUrl = typeof window !== 'undefined' && window.location
      ? `${window.location.origin}${window.location.pathname}`
      : '';

    const url = `${baseUrl}?overlay=${encoded}`;
    ctx.writeStdout(`${url}\r\n`);
    return { exitCode: 0 };
  },
});
