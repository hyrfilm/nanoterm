import '../../src/lib/commands/index';
import { createNanoTerm } from '../../src/lib';
import config from '../../src/nanoterm.config';

const container = document.getElementById('terminal');
if (!container) {
  throw new Error('missing #terminal container');
}

createNanoTerm(container, config);
