import { makeDir, type DirNode, type FSNode } from './types';

function m(entries: [string, FSNode][]): Record<string, FSNode> {
  return Object.fromEntries(entries);
}

export function createDefaultFS(): DirNode {
  const root = makeDir('', m([
    ['home', makeDir('home', m([
      ['guest', makeDir('guest', m([
        ['documents', makeDir('documents')],
        ['projects', makeDir('projects')],
      ]))],
    ]))],
    ['etc', makeDir('etc', m([
    ]), 'root', 'root')],
    ['tmp', makeDir('tmp')],
    ['var', makeDir('var', m([
      ['log', makeDir('log', m([
      ]), 'root', 'root')],
    ]), 'root', 'root')],
    ['usr', makeDir('usr', m([
      ['bin', makeDir('bin', {}, 'root', 'root')],
      ['share', makeDir('share', m([
        ['doc', makeDir('doc', m([
          ['nanoterm', makeDir('nanoterm', {}, 'root', 'root')],
        ]), 'root', 'root')],
      ]), 'root', 'root')],
    ]), 'root', 'root')],
  ]), 'root', 'root');

  return root;
}
