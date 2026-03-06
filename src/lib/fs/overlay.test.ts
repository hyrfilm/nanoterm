import { describe, expect, it } from 'vitest';
import { createDefaultFS } from './defaultFs';
import { VirtualFS } from './filesystem';
import { applyFSOverlay, parseOverlayJson } from './overlay';

describe('overlay helpers', () => {
  it('returns empty overlay for invalid JSON', () => {
    const parsed = parseOverlayJson('{not-json');
    expect(parsed).toEqual({ json: {}, text: {}, binary: {} });
  });

  it('applies json/text/binary overlay trees to filesystem', () => {
    const fs = new VirtualFS(createDefaultFS());

    applyFSOverlay(fs, {
      json: {
        etc: {
          'settings.json': { theme: 'dark' },
        },
      },
      text: {
        home: {
          guest: {
            'notes/new.txt': 'hello from overlay',
          },
        },
      },
      binary: {
        tmp: {
          'blob.bin': 'YWJj',
        },
      },
    });

    expect(fs.readFile('/etc/settings.json')).toBe(`{
  "theme": "dark"
}`);
    expect(fs.readFile('/home/guest/notes/new.txt')).toBe('hello from overlay');
    expect(fs.readFile('/tmp/blob.bin')).toBe('abc');
  });
});
