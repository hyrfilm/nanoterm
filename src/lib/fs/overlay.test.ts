import { describe, expect, it } from 'vitest';
import { createDefaultFS } from './defaultFs';
import { VirtualFS } from './filesystem';
import { applyFSOverlay, createSnapshotOverlay, emptyOverlay, encodeOverlayForUrl, forEachOverlayFile, parseOverlayJson, parseOverlayParam } from './overlay';

describe('overlay helpers', () => {
  it('returns empty overlay for invalid JSON', () => {
    const parsed = parseOverlayJson('{not-json');
    expect(parsed).toEqual(emptyOverlay);
  });

  it('parses the rooted tree format', () => {
    const parsed = parseOverlayJson(JSON.stringify({
      '/': {
        home: {
          guest: {
            'hello.txt': 'hello',
          },
        },
      },
    }));

    expect(parsed).toEqual({
      '/': {
        home: {
          guest: {
            'hello.txt': 'hello',
          },
        },
      },
    });
  });

  it('treats a top-level tree without "/" as rooted at "/"', () => {
    const parsed = parseOverlayJson(JSON.stringify({
      home: {
        guest: {
          'hello.txt': 'hello',
        },
      },
    }));

    expect(parsed).toEqual({
      '/': {
        home: {
          guest: {
            'hello.txt': 'hello',
          },
        },
      },
    });
  });

  it('applies rooted tree overlays to the filesystem', () => {
    const fs = new VirtualFS(createDefaultFS());

    applyFSOverlay(fs, {
      '/': {
        etc: {
          'settings.json': { theme: 'dark' },
        },
        home: {
          guest: {
            'notes/new.txt': 'hello from overlay',
          },
        },
        tmp: {
          'blob.bin': 'YWJj',
        },
      },
      _: {
        types: {
          '/': {
            etc: {
              'settings.json': 'json',
            },
            tmp: {
              'blob.bin': 'base64',
            },
          },
        },
      },
    });

    expect(fs.readFile('/etc/settings.json')).toBe(`{
  "theme": "dark"
}`);
    expect(fs.readFile('/home/guest/notes/new.txt')).toBe('hello from overlay');
    expect(fs.readFile('/tmp/blob.bin')).toBe('abc');
  });

  it('treats plain objects as directories unless _.types marks them as files', () => {
    const files: Array<{ path: string; content: string }> = [];

    forEachOverlayFile({
      '/': {
        etc: {
          'config.json': { theme: 'dark' },
        },
      },
      _: {
        types: {
          '/': {
            etc: {
              'config.json': 'json',
            },
          },
        },
      },
    }, (path, content) => {
      files.push({ path, content });
    });

    expect(files).toEqual([
      {
        path: '/etc/config.json',
        content: `{
  "theme": "dark"
}`,
      },
    ]);
  });

  it('can walk overlay files without depending on filesystem application', () => {
    const files: Array<{ path: string; content: string }> = [];

    forEachOverlayFile({
      '/': {
        home: {
          guest: {
            'playground.txt': 'hello',
          },
        },
      },
    }, (path, content) => {
      files.push({ path, content });
    });

    expect(files).toEqual([
      { path: '/home/guest/playground.txt', content: 'hello' },
    ]);
  });

  it('applies _.ops as path filters over the walked overlay files', () => {
    const files: string[] = [];

    forEachOverlayFile({
      '/': {
        home: {
          guest: {
            examples: {
              basic: {
                'one.txt': 'one',
              },
              advanced: {
                'two.txt': 'two',
              },
            },
          },
        },
      },
      _: {
        ops: [
          { '-': 'examples/' },
          { '+': 'examples/basic' },
        ],
      },
    }, (path) => {
      files.push(path);
    });

    expect(files).toEqual([
      '/home/guest/examples/basic/one.txt',
    ]);
  });

  it('round-trips a snapshot overlay through a URL parameter', () => {
    const fs = new VirtualFS(createDefaultFS());
    fs.writeFile('/home/guest/note.txt', 'hello');

    const overlay = createSnapshotOverlay(fs.root);
    const encoded = encodeOverlayForUrl(overlay);
    const decoded = parseOverlayParam(encoded);
    const files: Array<{ path: string; content: string }> = [];

    forEachOverlayFile(decoded, (path, content) => {
      files.push({ path, content });
    });

    expect(files).toContainEqual({
      path: '/home/guest/note.txt',
      content: 'hello',
    });
  });
});
