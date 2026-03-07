import '../../src/lib/commands/index';
import { createNanoTerm, defineNanoTermConfig } from '../../src/lib';

const container = document.getElementById('terminal');
if (!container) {
  throw new Error('missing #terminal container');
}

const config = defineNanoTermConfig({
  profile: {
    startupCommands: ['motd'],
  },
  fs: {
    backend: 'memory',
  },
  terminal: {
    fontSize: 13,
  },
});

createNanoTerm(container, config);
