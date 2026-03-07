import { makeDir, type DirNode, type FSNode } from './types';

function m(entries: [string, FSNode][]): Map<string, FSNode> {
  return new Map(entries);
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
      ['bin', makeDir('bin', new Map(), 'root', 'root')],
      ['share', makeDir('share', m([
        ['doc', makeDir('doc', m([
          ['nanoterm', makeDir('nanoterm', new Map(), 'root', 'root')],
        ]), 'root', 'root')],
      ]), 'root', 'root')],
    ]), 'root', 'root')],
  ]), 'root', 'root');

  return root;
}
