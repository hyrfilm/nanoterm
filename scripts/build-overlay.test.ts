import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = resolve(ROOT, 'src/generated/fs-overlay.json');

describe('build-overlay', () => {
  it('generates a deterministic minified overlay from the overlay directory', () => {
    const result = spawnSync(
      'node',
      ['scripts/build-overlay.mjs', '--fromDir', './overlay', '--out', OUT],
      { cwd: ROOT, encoding: 'utf8' },
    );

    expect(result.status, result.stderr).toBe(0);

    const output = readFileSync(OUT);
    const md5 = createHash('md5').update(output).digest('hex');

    expect(output.length).toBe(2810);
    expect(md5).toBe('d0d6152eed284a35ad6b1ea5f27d70a1');
  });
});
